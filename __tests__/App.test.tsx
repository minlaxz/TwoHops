/**
 * @format
 */

import React from 'react';
import { ActivityIndicator, Alert, Linking } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import App from '../App';
import { PROFILES_STORAGE_KEY } from '../src/services/profileStore';

jest.mock('react-native-config', () => ({
  ENV_SERVER_NAME: 'env-server',
  ENV_PROTOCOL: 'QUIC',
  ENV_DNS_SERVERS: '1.1.1.1',
  ENV_BUILD_NUMBER: '2025010100',
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

function iconNames(root: ReactTestRenderer.ReactTestInstance): string[] {
  return root.findAllByType(Ionicons).map(node => node.props.name);
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

afterEach(() => {
  jest.restoreAllMocks();
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

// The Traffic Log buffer subscribes once at app start; emit parsed rows
// through every registered onQueryLog listener, like emitNativeState does.
// The buffer is an app-lifetime singleton, so rows survive across tests in
// this file — every emitting test must use a domain unique to that test.
function emitQueryLog(domain: string) {
  for (const [listener] of VpnClient.onQueryLog.mock.calls) {
    listener({
      action: 'tunnel',
      protocol: 'tcp',
      source: '10.0.0.2:1234',
      destination: '1.2.3.4:443',
      domain,
      stamp: new Date('2026-01-01T00:00:00Z'),
    });
  }
}

async function openLogsTab(renderer: ReactTestRenderer.ReactTestRenderer) {
  const logsTab = tabButtons(renderer).find(node =>
    node.props.accessibilityLabel.startsWith('Logs'),
  )!;
  await ReactTestRenderer.act(async () => {
    logsTab.props.onPress();
  });
}

// Pressable forwards testID to nested nodes; the innermost one carries the
// resolved accessibilityState.
function segmentSelected(
  renderer: ReactTestRenderer.ReactTestRenderer,
  testID: string,
): boolean {
  const nodes = renderer.root.findAll(
    node =>
      node.props.testID === testID && typeof node.props.onPress === 'function',
  );
  return nodes[nodes.length - 1].props.accessibilityState.selected;
}

test('Logs tab shows a Traffic | Debug segmented control, Traffic first', async () => {
  const renderer = await renderApp();
  await openLogsTab(renderer);

  expect(segmentSelected(renderer, 'logs-segment-traffic')).toBe(true);
  expect(segmentSelected(renderer, 'logs-segment-debug')).toBe(false);

  await press(renderer, 'logs-segment-debug');
  expect(segmentSelected(renderer, 'logs-segment-debug')).toBe(true);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Traffic rows collect while the Logs tab is closed; Dashboard has no debug panel', async () => {
  const renderer = await renderApp();

  // The Dashboard's inline debug panel is gone.
  expect(renderedText(renderer)).not.toContain('Debug Logs');

  // Rows arrive while the Dashboard (not Logs) is the open screen.
  await ReactTestRenderer.act(async () => {
    emitQueryLog('earlyrow.example');
  });
  await openLogsTab(renderer);

  expect(renderedText(renderer)).toContain('*.earlyrow.example');

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('debug entries appear in the Debug segment of the Logs tab', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    fab(renderer)!.props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  await openLogsTab(renderer);
  await press(renderer, 'logs-segment-debug');

  const text = renderedText(renderer);
  // The accepted connect command clears both logs, so pre-command lines
  // ("Connect button pressed.") are gone; the session's own lines survive.
  expect(text).not.toContain('Connect button pressed.');
  expect(text).toContain('Setup config:');
  expect(text).toContain('Native event: connected.');

  await ReactTestRenderer.act(async () => {
    emitNativeState('disconnected');
  });
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Clear button empties the visible log segment', async () => {
  const renderer = await renderApp();
  await ReactTestRenderer.act(async () => {
    emitQueryLog('doomedrow.example');
  });
  await openLogsTab(renderer);
  expect(renderedText(renderer)).toContain('*.doomedrow.example');

  await press(renderer, 'logs-clear');
  expect(renderedText(renderer)).not.toContain('*.doomedrow.example');

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
  expect(iconNames(node)).toContain('play');

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

  // `disconnecting` is Busy too: press Stop, reconciliation pending again.
  await ReactTestRenderer.act(async () => {
    fab(renderer)!.props.onPress();
  });
  expect(fab(renderer)!.props.accessibilityState.disabled).toBe(true);
  expect(renderer.root.findAllByType(ActivityIndicator).length).toBe(1);
  expect(renderedText(renderer)).toContain('Busy');

  await ReactTestRenderer.act(async () => {
    emitNativeState('disconnected');
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
  expect(iconNames(node)).toContain('stop');

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
    emitNativeState('waitingForRecovery');
  });
  text = renderedText(renderer);
  expect(text).toContain('Running');
  expect(text).toContain('Reconnecting…');
  expect(fab(renderer)!.props.accessibilityLabel).toBe('Stop tunnel');

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
    'No profiles yet. Tap + to add one.',
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

// Pressable forwards testID to nested nodes; keep the composite node.
function pressableByTestID(
  renderer: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  const nodes = renderer.root.findAll(
    node =>
      node.props.testID === testID && typeof node.props.onPress === 'function',
  );
  return nodes[0] ?? null;
}

function textInputByTestID(
  renderer: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  return renderer.root.findAll(
    node =>
      node.props.testID === testID &&
      typeof node.props.onChangeText === 'function',
  )[0];
}

async function press(
  renderer: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  await ReactTestRenderer.act(async () => {
    pressableByTestID(renderer, testID)!.props.onPress();
  });
}

test('"+" → New profile opens a blank editor for the new profile', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await press(renderer, 'profile-add');
  await press(renderer, 'profile-add-new');

  // Editor pushed, loaded with the numbered new profile, no credentials.
  expect(renderedText(renderer)).toContain('Configurations');
  expect(textInputByTestID(renderer, 'profile-name-input').props.value).toBe(
    'Profile 1',
  );
  expect(profileRows(renderer)).toHaveLength(3);
  // Selection stays on Alpha — adding is not selecting.
  expect(
    profileRows(renderer).map(row => row.props.accessibilityState.selected),
  ).toEqual([true, false, false]);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('"+" → Paste profile link creates and selects while Stopped', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await press(renderer, 'profile-add');
  await press(renderer, 'profile-add-link');
  await ReactTestRenderer.act(async () => {
    textInputByTestID(renderer, 'profile-link-input').props.onChangeText(
      'twohops://x?login=bob&password=pw&ip=10.9.9.9&domain=d.example.com',
    );
  });
  await press(renderer, 'profile-link-apply');

  const rows = profileRows(renderer);
  expect(rows).toHaveLength(3);
  expect(rows.map(row => row.props.accessibilityState.selected)).toEqual([
    false,
    false,
    true,
  ]);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('a bad pasted link alerts and creates nothing', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await seedTwoProfiles();
  const renderer = await renderApp();

  await press(renderer, 'profile-add');
  await press(renderer, 'profile-add-link');
  await ReactTestRenderer.act(async () => {
    textInputByTestID(renderer, 'profile-link-input').props.onChangeText(
      'https://not-a-profile-link',
    );
  });
  await press(renderer, 'profile-link-apply');

  expect(alert).toHaveBeenCalledWith('Profile Link failed', expect.anything());
  expect(profileRows(renderer)).toHaveLength(2);

  alert.mockRestore();
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('a Profile Link while Running creates without selecting', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  await press(renderer, 'profile-add');
  await press(renderer, 'profile-add-link');
  await ReactTestRenderer.act(async () => {
    textInputByTestID(renderer, 'profile-link-input').props.onChangeText(
      'twohops://x?login=bob',
    );
  });
  await press(renderer, 'profile-link-apply');

  const rows = profileRows(renderer);
  expect(rows).toHaveLength(3);
  expect(rows.map(row => row.props.accessibilityState.selected)).toEqual([
    true,
    false,
    false,
  ]);

  await ReactTestRenderer.act(async () => {
    emitNativeState('disconnected');
  });
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('pencil opens the editor for that profile; rename shows on the card', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await press(renderer, 'profile-edit-b');

  const nameInput = textInputByTestID(renderer, 'profile-name-input');
  expect(nameInput.props.value).toBe('Beta');
  await ReactTestRenderer.act(async () => {
    nameInput.props.onChangeText('Backup');
  });

  // The Dashboard stays mounted beneath the pushed editor.
  expect(renderedText(renderer)).toContain('Backup');
  expect(renderedText(renderer)).not.toContain('Beta');
  // Editing is not selecting: Alpha keeps the selection.
  expect(
    profileRows(renderer).map(row => row.props.accessibilityState.selected),
  ).toEqual([true, false]);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('pencil edits land on that profile only; tunnel still starts from the Selected Profile', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await press(renderer, 'profile-edit-b');
  const username = renderer.root.findAll(
    node =>
      node.props.placeholder === 'Username' &&
      typeof node.props.onChangeText === 'function',
  )[0];
  await ReactTestRenderer.act(async () => {
    username.props.onChangeText('edited-user');
  });

  await ReactTestRenderer.act(async () => {
    fab(renderer)!.props.onPress();
  });
  expect(VpnClient.start).toHaveBeenCalledWith(
    expect.objectContaining({
      server: expect.objectContaining({ name: 'Alpha', login: 'user' }),
    }),
  );

  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('deleting the Selected Profile is blocked while Running', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await seedTwoProfiles();
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  await press(renderer, 'profile-edit-a');
  await press(renderer, 'profile-delete');

  expect(alert).toHaveBeenCalledWith(
    'Cannot delete',
    expect.stringContaining('Stop the tunnel'),
  );
  expect(profileRows(renderer)).toHaveLength(2);

  alert.mockRestore();
  await ReactTestRenderer.act(async () => {
    emitNativeState('disconnected');
  });
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('deleting the Selected Profile while Stopped reselects the other', async () => {
  const alert = jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) => {
      buttons?.find(button => button.style === 'destructive')?.onPress?.();
    });
  await seedTwoProfiles();
  const renderer = await renderApp();

  await press(renderer, 'profile-edit-a');
  await press(renderer, 'profile-delete');

  const rows = profileRows(renderer);
  expect(rows).toHaveLength(1);
  expect(rows[0].props.testID).toBe('profile-row-b');
  expect(rows[0].props.accessibilityState.selected).toBe(true);
  // The editor for the deleted profile has been popped.
  expect(renderedText(renderer)).not.toContain('Configurations');

  alert.mockRestore();
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('a twohops: deep link creates and selects while Stopped', async () => {
  jest
    .spyOn(Linking, 'getInitialURL')
    .mockResolvedValue('twohops://x?login=bob&ip=10.9.9.9');
  await seedTwoProfiles();
  const renderer = await renderApp();

  const rows = profileRows(renderer);
  expect(rows).toHaveLength(3);
  expect(rows.map(row => row.props.accessibilityState.selected)).toEqual([
    false,
    false,
    true,
  ]);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('a twohops: deep link while Running creates without selecting', async () => {
  // Hold the initial URL until the tunnel is Running, then release it.
  let releaseInitialURL!: (url: string) => void;
  jest
    .spyOn(Linking, 'getInitialURL')
    .mockReturnValue(new Promise(resolve => (releaseInitialURL = resolve)));
  await seedTwoProfiles();
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  await ReactTestRenderer.act(async () => {
    releaseInitialURL('twohops://x?login=bob');
  });

  const rows = profileRows(renderer);
  expect(rows).toHaveLength(3);
  expect(rows.map(row => row.props.accessibilityState.selected)).toEqual([
    true,
    false,
    false,
  ]);

  await ReactTestRenderer.act(async () => {
    emitNativeState('disconnected');
  });
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('theme change stays on Settings and keeps Debug Logs (issue #49)', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  // Produce a debug entry, then leave for Settings.
  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  const settingsTab = tabButtons(renderer).find(node =>
    node.props.accessibilityLabel.startsWith('Settings'),
  )!;
  await ReactTestRenderer.act(async () => {
    settingsTab.props.onPress();
  });

  const darkButton = renderer.root.findAll(
    node =>
      node.props.title === 'Dark' && typeof node.props.onPress === 'function',
  )[0];
  await ReactTestRenderer.act(async () => {
    darkButton.props.onPress();
  });

  // Theme applied, navigation did not reset to Dashboard.
  let text = renderedText(renderer);
  // renderedText joins JSX text children with newlines: "Theme: " / "dark".
  expect(text).toMatch(/Theme: ?\ndark/);
  expect(text).toContain('Appearance');
  // Pressable spreads props across nested nodes; any Settings-tab node
  // carrying accessibilityState reports the selected tab.
  expect(
    renderer.root
      .findAll(
        node =>
          typeof node.props.accessibilityLabel === 'string' &&
          node.props.accessibilityLabel.startsWith('Settings, tab,') &&
          node.props.accessibilityState !== undefined,
      )
      .some(node => node.props.accessibilityState.selected === true),
  ).toBe(true);
  // Tunnel Session state survived too: Dashboard still shows Running.
  expect(text).toContain('Running');

  // Debug Logs survived the theme change.
  await openLogsTab(renderer);
  await press(renderer, 'logs-segment-debug');
  expect(renderedText(renderer)).toContain('Native event: connected.');

  await ReactTestRenderer.act(async () => {
    emitNativeState('disconnected');
  });
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
  // About section (issue #50): version + build from CI env, core pin, licenses.
  expect(text).toContain('About');
  expect(text).toContain(`${require('../package.json').version} (2025010100)`);
  expect(text).toContain('Core Version');
  expect(text).toContain('1.1.3');
  expect(text).toContain('App License');
  expect(text).toContain('Core License');
  expect(text).toContain('Apache-2.0');

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});
