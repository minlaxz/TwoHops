/**
 * @format
 */

import React from 'react';
import { ActivityIndicator } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { PROFILES_STORAGE_KEY } from '../src/services/profileStore';

jest.mock('react-native-config', () => ({
  ENV_SERVER_NAME: 'env-server',
  ENV_PROTOCOL: 'QUIC',
  ENV_DNS_SERVERS: '1.1.1.1',
}));
jest.mock('../src/services/vpn', () => ({
  VpnClient: {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    getCurrentState: jest.fn().mockResolvedValue('disconnected'),
    onState: jest.fn(() => jest.fn()),
    onQueryLog: jest.fn(() => jest.fn()),
  },
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// Without this mock SafeAreaProvider waits for native insets that never
// arrive under react-test-renderer, so the app renders an empty tree.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

function renderedText(renderer: ReactTestRenderer.ReactTestRenderer): string {
  return renderer.root
    .findAll(node => typeof node.type === 'string')
    .flatMap(node =>
      React.Children.toArray(node.props.children).filter(
        child => typeof child === 'string',
      ),
    )
    .join('\n');
}

// The tab bar renders several nested pressables per tab with the same
// accessibility label ("<name>, tab, <n> of <m>"); keep one node per label.
function tabButtons(renderer: ReactTestRenderer.ReactTestRenderer) {
  const byLabel = new Map<string, ReactTestRenderer.ReactTestInstance>();
  for (const node of renderer.root.findAll(
    candidate =>
      typeof candidate.props.onPress === 'function' &&
      typeof candidate.props.accessibilityLabel === 'string' &&
      candidate.props.accessibilityLabel.includes(', tab,'),
  )) {
    byLabel.set(node.props.accessibilityLabel, node);
  }
  return [...byLabel.values()];
}

const { VpnClient } = require('../src/services/vpn');

// The Tunnel Session is created once and shared across renders, so tests
// change its state through the native event listener, not getCurrentState.
function emitNativeState(state: string) {
  for (const [listener] of VpnClient.onState.mock.calls) {
    listener(state);
  }
}

beforeEach(async () => {
  await AsyncStorage.clear();
  VpnClient.start.mockClear();
  VpnClient.stop.mockClear();
  emitNativeState('disconnected');
});

function profileEntry(id: string, name: string, ipAddress = '10.0.0.1') {
  return {
    version: 1,
    server: {
      name,
      ipAddress,
      domain: 'vpn.example.com',
      login: 'user',
      password: 'pw',
      vpnProtocol: 'QUIC',
    },
    dnsServers: ['1.1.1.1'],
    routingMode: 'selective',
    localRulesText: '',
    remoteRulesURL: '',
    importedRules: [],
    importedAt: null,
    id,
    name,
  };
}

async function seedTwoProfiles() {
  await AsyncStorage.setItem(
    PROFILES_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      profiles: [profileEntry('a', 'Alpha'), profileEntry('b', 'Beta')],
      selectedId: 'a',
    }),
  );
}

// Pressable forwards its props to nested nodes; the composite node carries
// both onPress and the accessibility props.
function fab(renderer: ReactTestRenderer.ReactTestRenderer) {
  const nodes = renderer.root.findAll(
    node =>
      node.props.testID === 'fab' && typeof node.props.onPress === 'function',
  );
  return nodes[0] ?? null;
}

function fabIsHidden(renderer: ReactTestRenderer.ReactTestRenderer) {
  return (
    renderer.root.findAll(node => node.props.testID === 'fab').length === 0
  );
}

// Pressable forwards testID to nested nodes; keep one node per row id.
function profileRows(renderer: ReactTestRenderer.ReactTestRenderer) {
  const byId = new Map<string, ReactTestRenderer.ReactTestInstance>();
  for (const node of renderer.root.findAll(
    candidate =>
      typeof candidate.props.onPress === 'function' &&
      typeof candidate.props.testID === 'string' &&
      candidate.props.testID.startsWith('profile-row-'),
  )) {
    byId.set(node.props.testID, node);
  }
  return [...byId.values()];
}

// The async act flushes the tunnel session's state-seed promise so it does
// not resolve after teardown and crash the test worker.
async function renderApp(): Promise<ReactTestRenderer.ReactTestRenderer> {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  return renderer;
}

test('renders bottom tabs Dashboard / Logs / Settings', async () => {
  const renderer = await renderApp();

  const labels = tabButtons(renderer).map(
    node => node.props.accessibilityLabel.split(',')[0],
  );
  expect(labels).toEqual(['Dashboard', 'Logs', 'Settings']);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Logs tab shows Traffic Logs', async () => {
  const renderer = await renderApp();

  const logsTab = tabButtons(renderer).find(node =>
    node.props.accessibilityLabel.startsWith('Logs'),
  )!;
  await ReactTestRenderer.act(async () => {
    logsTab.props.onPress();
  });

  expect(renderedText(renderer)).toContain('Traffic Logs');

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Profile opens above the tabs from Dashboard', async () => {
  const renderer = await renderApp();

  const profileButton = renderer.root.find(
    node =>
      node.props.title === 'Profile' &&
      typeof node.props.onPress === 'function',
  );
  await ReactTestRenderer.act(async () => {
    profileButton.props.onPress();
  });

  const text = renderedText(renderer);
  expect(text).toContain('Configurations');
  // The tab bar stays mounted beneath the pushed Profile screen.
  expect(tabButtons(renderer).length).toBe(3);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Profiles card lists profiles and highlights the Selected Profile', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  const text = renderedText(renderer);
  expect(text).toContain('Profiles');
  expect(text).toContain('Alpha');
  expect(text).toContain('Beta');
  expect(
    profileRows(renderer).map(row => row.props.accessibilityState.selected),
  ).toEqual([true, false]);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('tapping a profile while Stopped selects it', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    profileRows(renderer)[1].props.onPress();
  });

  expect(
    profileRows(renderer).map(row => row.props.accessibilityState.selected),
  ).toEqual([false, true]);
  expect(renderedText(renderer)).not.toContain('Stop the tunnel');

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('tapping a profile while Running is locked with a toast', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  await ReactTestRenderer.act(async () => {
    profileRows(renderer)[1].props.onPress();
  });

  expect(renderedText(renderer)).toContain(
    'Stop the tunnel to switch profiles.',
  );
  expect(
    profileRows(renderer).map(row => row.props.accessibilityState.selected),
  ).toEqual([true, false]);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('tapping a profile in a recovery state is locked too', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    emitNativeState('waitingForRecovery');
  });
  await ReactTestRenderer.act(async () => {
    profileRows(renderer)[1].props.onPress();
  });

  expect(renderedText(renderer)).toContain(
    'Stop the tunnel to switch profiles.',
  );
  expect(
    profileRows(renderer).map(row => row.props.accessibilityState.selected),
  ).toEqual([true, false]);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('tunnel start reads the Selected Profile', async () => {
  await AsyncStorage.setItem(
    PROFILES_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      profiles: [
        profileEntry('a', 'Alpha', '10.0.0.1'),
        profileEntry('b', 'Beta', '10.0.0.2'),
      ],
      selectedId: 'a',
    }),
  );
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    profileRows(renderer)[1].props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    fab(renderer)!.props.onPress();
  });

  expect(VpnClient.start).toHaveBeenCalledWith(
    expect.objectContaining({
      server: expect.objectContaining({ name: 'Beta', ipAddress: '10.0.0.2' }),
    }),
  );

  // Settle the session so its reconciliation probes stop.
  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('FAB shows Play when Stopped and starts the tunnel', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  const node = fab(renderer)!;
  expect(node.props.accessibilityLabel).toBe('Start tunnel');
  expect(renderedText(renderer)).toContain('Stopped');
  expect(renderedText(renderer)).toContain('▶');

  await ReactTestRenderer.act(async () => {
    node.props.onPress();
  });
  expect(VpnClient.start).toHaveBeenCalled();

  // Settle the session so its reconciliation probes stop.
  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('FAB is a disabled spinner while Busy', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    fab(renderer)!.props.onPress();
  });

  // start() resolved but reconciliation has not settled: still `connecting`.
  const node = fab(renderer)!;
  expect(node.props.accessibilityState.disabled).toBe(true);
  expect(renderer.root.findAllByType(ActivityIndicator).length).toBe(1);
  expect(renderedText(renderer)).toContain('Busy');

  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('FAB shows Stop when Running and stops the tunnel', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });

  const node = fab(renderer)!;
  expect(node.props.accessibilityLabel).toBe('Stop tunnel');
  expect(renderedText(renderer)).toContain('Running');
  expect(renderedText(renderer)).toContain('■');

  await ReactTestRenderer.act(async () => {
    node.props.onPress();
  });
  expect(VpnClient.stop).toHaveBeenCalled();

  await ReactTestRenderer.act(async () => {
    emitNativeState('disconnected');
  });
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('recovery states show Running plus a detail label with Stop available', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    emitNativeState('waitingForNetwork');
  });
  let text = renderedText(renderer);
  expect(text).toContain('Running');
  expect(text).toContain('Waiting for network…');
  expect(fab(renderer)!.props.accessibilityLabel).toBe('Stop tunnel');

  await ReactTestRenderer.act(async () => {
    emitNativeState('recovering');
  });
  text = renderedText(renderer);
  expect(text).toContain('Running');
  expect(text).toContain('Reconnecting…');

  await ReactTestRenderer.act(async () => {
    emitNativeState('disconnected');
  });
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('empty Profile List hides the FAB and hints to create a profile', async () => {
  await AsyncStorage.setItem(
    PROFILES_STORAGE_KEY,
    JSON.stringify({ version: 1, profiles: [], selectedId: null }),
  );
  const renderer = await renderApp();

  expect(fabIsHidden(renderer)).toBe(true);
  expect(renderedText(renderer)).toContain(
    'No profiles yet. Open Profile to create one.',
  );

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('incomplete Selected Profile hides the FAB and lists missing fields', async () => {
  const incomplete = profileEntry('a', 'Alpha');
  incomplete.server.login = '';
  incomplete.server.password = '';
  await AsyncStorage.setItem(
    PROFILES_STORAGE_KEY,
    JSON.stringify({ version: 1, profiles: [incomplete], selectedId: 'a' }),
  );
  const renderer = await renderApp();

  expect(fabIsHidden(renderer)).toBe(true);
  const text = renderedText(renderer);
  expect(text).toContain('login');
  expect(text).toContain('password');
  expect(text).toContain('Profile incomplete');

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Settings tab shows theme picker and app version', async () => {
  const renderer = await renderApp();

  const settingsTab = tabButtons(renderer).find(node =>
    node.props.accessibilityLabel.startsWith('Settings'),
  )!;
  await ReactTestRenderer.act(async () => {
    settingsTab.props.onPress();
  });

  const text = renderedText(renderer);
  expect(text).toContain('Appearance');
  expect(text).toContain(require('../package.json').version);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});
