/**
 * @format
 */

import React from 'react';
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
  emitNativeState('disconnected');
});

function profileEntry(id: string, name: string) {
  return {
    version: 1,
    server: {
      name,
      ipAddress: '10.0.0.1',
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
