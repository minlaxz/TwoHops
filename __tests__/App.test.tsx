/**
 * @format
 */

import React from 'react';
import { ActivityIndicator, Linking } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import App from '../App';
import { PROFILES_STORAGE_KEY } from '../src/services/profileStore';
import { TOAST_DURATION_MS } from '../src/components/AppToast';

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
// The iOS BackHandler is a no-op stub, so react-navigation's hardware-back
// listener never registers under jest. This mock makes back navigation
// testable: mockPressBack() runs listeners newest-first like Android does.
jest.mock('react-native/Libraries/Utilities/BackHandler', () => {
  const handlers: Array<() => boolean | null | undefined> = [];
  return {
    __esModule: true,
    default: {
      exitApp: jest.fn(),
      addEventListener: (
        _event: string,
        handler: () => boolean | null | undefined,
      ) => {
        handlers.push(handler);
        return {
          remove: () => {
            const at = handlers.indexOf(handler);
            if (at !== -1) {
              handlers.splice(at, 1);
            }
          },
        };
      },
      mockPressBack: () => {
        for (const handler of [...handlers].reverse()) {
          if (handler()) {
            break;
          }
        }
      },
    },
  };
});

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

// Logging toggles default OFF (issue #69); tests that expect log capture
// or the Logs tabs seed them ON before rendering.
async function seedLogSettings({ debug = true, traffic = true } = {}) {
  await AsyncStorage.setItem(
    '@twohops/logs/settings',
    JSON.stringify({
      debugLoggingEnabled: debug,
      trafficLoggingEnabled: traffic,
    }),
  );
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
  await seedLogSettings();
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
  await seedLogSettings();
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
  await seedLogSettings();
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
  await seedLogSettings();
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

test('Clear hides while the visible segment is empty', async () => {
  await seedLogSettings();
  const renderer = await renderApp();
  await openLogsTab(renderer);

  // Traffic segment starts empty: no dead Clear over an empty list.
  expect(
    renderer.root.findAll(n => n.props.testID === 'logs-clear'),
  ).toHaveLength(0);

  await ReactTestRenderer.act(async () => {
    emitQueryLog('freshrow.example');
  });
  expect(
    renderer.root.findAll(n => n.props.testID === 'logs-clear').length,
  ).toBeGreaterThan(0);

  await press(renderer, 'logs-clear');
  expect(
    renderer.root.findAll(n => n.props.testID === 'logs-clear'),
  ).toHaveLength(0);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('both toggles OFF: Logs hides tabs and Clear, placeholder tracks Display State', async () => {
  const renderer = await renderApp();
  await openLogsTab(renderer);

  // Defaults are OFF: no segment tabs, no Clear, neutral placeholder.
  expect(
    renderer.root.findAll(n => n.props.testID === 'logs-segment-traffic'),
  ).toHaveLength(0);
  expect(
    renderer.root.findAll(n => n.props.testID === 'logs-segment-debug'),
  ).toHaveLength(0);
  expect(
    renderer.root.findAll(n => n.props.testID === 'logs-clear'),
  ).toHaveLength(0);
  expect(renderedText(renderer)).toContain('Logging is turned off.');

  // While Running the placeholder switches to the standing line.
  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  expect(renderedText(renderer)).toContain('Here I stand :)');

  await ReactTestRenderer.act(async () => {
    emitNativeState('disconnected');
  });
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('one toggle OFF hides only its tab; buffered rows return on re-enable', async () => {
  await seedLogSettings({ debug: true, traffic: false });
  const renderer = await renderApp();
  await openLogsTab(renderer);

  // Traffic tab hidden, Debug tab shown and selected by fallback.
  expect(
    renderer.root.findAll(n => n.props.testID === 'logs-segment-traffic'),
  ).toHaveLength(0);
  expect(segmentSelected(renderer, 'logs-segment-debug')).toBe(true);

  // Flip Traffic Logging ON from Settings; its tab reappears on Logs.
  const settingsTab = tabButtons(renderer).find(node =>
    node.props.accessibilityLabel.startsWith('Settings'),
  )!;
  await ReactTestRenderer.act(async () => {
    settingsTab.props.onPress();
  });
  await press(renderer, 'settings-section-debug');
  const trafficSwitch = renderer.root.findAll(
    n =>
      n.props.testID === 'settings-traffic-logging' &&
      typeof n.props.onValueChange === 'function',
  )[0];
  await ReactTestRenderer.act(async () => {
    trafficSwitch.props.onValueChange(true);
  });
  await openLogsTab(renderer);
  expect(
    renderer.root.findAll(n => n.props.testID === 'logs-segment-traffic')
      .length,
  ).toBeGreaterThan(0);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('"+" opens a sheet; "New profile" routes to the create editor (issue #81)', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  // Nothing offered until "+" is pressed.
  expect(pressableByTestID(renderer, 'profile-add-new')).toBeNull();
  await press(renderer, 'profile-add');
  const text = renderedText(renderer);
  expect(text).toContain('New profile');
  expect(text).toContain('Paste profile link');

  await press(renderer, 'profile-add-new');
  // Sheet dismissed, editor pushed in create mode with the link input
  // present but not focused — the blank Draft is the point.
  expect(pressableByTestID(renderer, 'profile-add-new')).toBeNull();
  expect(renderedText(renderer)).toContain('Configurations');
  expect(
    textInputByTestID(renderer, 'profile-link-input').props.autoFocus,
  ).toBeFalsy();

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('"Paste profile link" routes to the create editor with the link input focused (issue #81)', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await press(renderer, 'profile-add');
  await press(renderer, 'profile-add-link');

  expect(pressableByTestID(renderer, 'profile-add-link')).toBeNull();
  expect(renderedText(renderer)).toContain('Configurations');
  expect(
    textInputByTestID(renderer, 'profile-link-input').props.autoFocus,
  ).toBe(true);
  // Still a Draft: the Profile List is untouched.
  expect(profileRows(renderer)).toHaveLength(2);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('"+" opens the editor above the tabs in create mode', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await openCreateEditor(renderer);

  const text = renderedText(renderer);
  expect(text).toContain('Configurations');
  // Create mode leads with the link input; Advanced starts collapsed.
  expect(textInputByTestID(renderer, 'profile-link-input')).toBeDefined();
  expect(textInputByTestID(renderer, 'profile-name-input')).toBeUndefined();
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
  // The empty-state hint only renders with an empty Profile List.
  expect(text).not.toContain('No profiles yet.');
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

test('tapping a profile while Running raises a Toast that auto-dismisses', async () => {
  jest.useFakeTimers();
  try {
    await seedTwoProfiles();
    const renderer = await renderApp();

    await ReactTestRenderer.act(async () => {
      emitNativeState('connected');
    });
    await ReactTestRenderer.act(async () => {
      profileRows(renderer)[1].props.onPress();
    });

    const toast = renderer.root.findByProps({ testID: 'app-toast' });
    expect(renderedText(renderer)).toContain(
      'Stop the tunnel to switch profiles.',
    );
    expect(toast).toBeTruthy();
    expect(
      profileRows(renderer).map(row => row.props.accessibilityState.selected),
    ).toEqual([true, false]);

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(renderer.root.findAllByProps({ testID: 'app-toast' })).toHaveLength(
      0,
    );
    expect(renderedText(renderer)).not.toContain(
      'Stop the tunnel to switch profiles.',
    );

    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });
  } finally {
    jest.useRealTimers();
  }
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
  // The control alone carries the Display State — no status caption (#61).
  expect(renderedText(renderer)).not.toContain('Stopped');
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

test('add and edit-pencil controls render Ionicons glyphs', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  expect(iconNames(pressableByTestID(renderer, 'profile-add')!)).toContain(
    'add',
  );

  const editButtons = renderer.root.findAll(
    node =>
      typeof node.props.testID === 'string' &&
      node.props.testID.startsWith('profile-edit-') &&
      typeof node.props.onPress === 'function',
  );
  expect(editButtons.length).toBeGreaterThan(0);
  for (const button of editButtons) {
    expect(iconNames(button)).toContain('pencil');
  }

  expect(renderedText(renderer)).not.toContain('＋');
  expect(renderedText(renderer)).not.toContain('✎');

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
  expect(renderedText(renderer)).not.toContain('Busy');

  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });

  // `disconnecting` is Busy too: press Stop, reconciliation pending again.
  await ReactTestRenderer.act(async () => {
    fab(renderer)!.props.onPress();
  });
  expect(fab(renderer)!.props.accessibilityState.disabled).toBe(true);
  expect(renderer.root.findAllByType(ActivityIndicator).length).toBe(1);
  expect(renderedText(renderer)).not.toContain('Busy');

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
  expect(renderedText(renderer)).not.toContain('Running');
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

test('Toasts announce Connected and Disconnected transitions, never Busy', async () => {
  jest.useFakeTimers();
  try {
    await seedTwoProfiles();
    const renderer = await renderApp();

    // Mounting announces nothing.
    expect(renderer.root.findAllByProps({ testID: 'app-toast' })).toHaveLength(
      0,
    );

    // Busy (connecting) raises no toast — the FAB spinner covers it.
    await ReactTestRenderer.act(async () => {
      fab(renderer)!.props.onPress();
    });
    expect(renderer.root.findAllByProps({ testID: 'app-toast' })).toHaveLength(
      0,
    );

    await ReactTestRenderer.act(async () => {
      emitNativeState('connected');
    });
    expect(renderedText(renderer)).toContain('Connected');

    // The toast auto-dismisses; no permanent status chrome replaces it.
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(renderedText(renderer)).not.toContain('Connected');

    // Busy again (disconnecting): still no toast.
    await ReactTestRenderer.act(async () => {
      fab(renderer)!.props.onPress();
    });
    expect(renderer.root.findAllByProps({ testID: 'app-toast' })).toHaveLength(
      0,
    );

    await ReactTestRenderer.act(async () => {
      emitNativeState('disconnected');
    });
    expect(renderedText(renderer)).toContain('Disconnected');

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(renderer.root.findAllByProps({ testID: 'app-toast' })).toHaveLength(
      0,
    );

    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });
  } finally {
    jest.useRealTimers();
  }
});

test('recovery states keep a persistent detail label that clears on recovery', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    emitNativeState('waitingForNetwork');
  });
  let text = renderedText(renderer);
  expect(text).toContain('Waiting for network…');
  expect(text).not.toContain('Running');
  expect(fab(renderer)!.props.accessibilityLabel).toBe('Stop tunnel');

  await ReactTestRenderer.act(async () => {
    emitNativeState('recovering');
  });
  expect(renderedText(renderer)).toContain('Reconnecting…');

  await ReactTestRenderer.act(async () => {
    emitNativeState('waitingForRecovery');
  });
  expect(renderedText(renderer)).toContain('Reconnecting…');
  expect(fab(renderer)!.props.accessibilityLabel).toBe('Stop tunnel');

  // The labels are tied to the recovery Session States: recovery succeeding
  // removes them; nothing else persistent takes their place.
  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  text = renderedText(renderer);
  expect(text).not.toContain('Reconnecting…');
  expect(text).not.toContain('Waiting for network…');

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

test('incomplete legacy profile shows no hint; connect refuses with the alert', async () => {
  const incomplete = profileEntry('a', 'Alpha');
  incomplete.server.login = '';
  incomplete.server.password = '';
  await AsyncStorage.setItem(
    PROFILES_STORAGE_KEY,
    JSON.stringify({ version: 1, profiles: [incomplete], selectedId: 'a' }),
  );
  const renderer = await renderApp();

  // No persistent nag (#61): the connect-refusal alert is the only guard.
  expect(renderedText(renderer)).not.toContain('Profile incomplete');
  expect(fabIsHidden(renderer)).toBe(false);

  await ReactTestRenderer.act(async () => {
    fab(renderer)!.props.onPress();
  });
  expect(VpnClient.start).not.toHaveBeenCalled();
  const text = renderedText(renderer);
  expect(text).toContain('Connect refused');
  expect(text).toContain('Profile incomplete:');
  expect(text).toContain('login');
  expect(text).toContain('password');

  await press(renderer, 'alert-button-OK');
  expect(renderedText(renderer)).not.toContain('Connect refused');

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

// "+" opens the add-profile sheet (issue #81); "New profile" is the route
// every create-mode test used to reach directly.
async function openCreateEditor(renderer: ReactTestRenderer.ReactTestRenderer) {
  await press(renderer, 'profile-add');
  await press(renderer, 'profile-add-new');
}

// Android hardware back / header back: both run the same navigation pop,
// which is what raises the Profile Draft discard confirmation.
async function pressBack() {
  const { BackHandler } = require('react-native');
  await ReactTestRenderer.act(async () => {
    (BackHandler as unknown as { mockPressBack: () => void }).mockPressBack();
  });
}

test('"+" opens a blank Profile Draft without touching the Profile List', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await openCreateEditor(renderer);

  // Editor pushed in create mode; expand Advanced to reach the fields.
  expect(renderedText(renderer)).toContain('Configurations');
  await press(renderer, 'profile-advanced-toggle');
  // The name field starts blank — no generated "Profile n".
  expect(textInputByTestID(renderer, 'profile-name-input').props.value).toBe(
    '',
  );
  // Nothing was added to the list or persisted.
  expect(profileRows(renderer)).toHaveLength(2);
  expect(
    JSON.parse((await AsyncStorage.getItem(PROFILES_STORAGE_KEY))!).profiles,
  ).toHaveLength(2);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Apply Link patches the Profile Draft; the Profile List is untouched', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await openCreateEditor(renderer);
  await ReactTestRenderer.act(async () => {
    textInputByTestID(renderer, 'profile-link-input').props.onChangeText(
      'twohops://x?login=bob&password=pw&ip=10.9.9.9&domain=d.example.com',
    );
  });
  await press(renderer, 'profile-link-apply');

  // Success auto-expands Advanced with the link's fields applied to the draft.
  const username = renderer.root.findAll(
    node =>
      node.props.placeholder === 'Username' &&
      typeof node.props.onChangeText === 'function',
  )[0];
  expect(username.props.value).toBe('bob');
  // The draft is not a Profile List entry: still just the two seeded rows.
  expect(profileRows(renderer)).toHaveLength(2);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Create is gated on Profile Completeness and commits exactly one profile', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await openCreateEditor(renderer);
  // Blank draft: Create renders (outside Advanced) but stays disabled.
  expect(pressableByTestID(renderer, 'profile-create')!.props.disabled).toBe(
    true,
  );

  await ReactTestRenderer.act(async () => {
    textInputByTestID(renderer, 'profile-link-input').props.onChangeText(
      'twohops://x?login=bob&password=pw&ip=10.9.9.9&domain=d.example.com',
    );
  });
  await press(renderer, 'profile-link-apply');

  // Env server name + the link's fields satisfy the Completeness gate.
  expect(pressableByTestID(renderer, 'profile-create')!.props.disabled).toBe(
    false,
  );

  await ReactTestRenderer.act(async () => {
    textInputByTestID(renderer, 'profile-name-input').props.onChangeText(
      'My VPN',
    );
  });
  await press(renderer, 'profile-create');

  // Editor closed; the committed profile is on the card, unselected, persisted.
  expect(renderedText(renderer)).not.toContain('Configurations');
  expect(renderedText(renderer)).toContain('My VPN');
  const rows = profileRows(renderer);
  expect(rows).toHaveLength(3);
  expect(rows.map(row => row.props.accessibilityState.selected)).toEqual([
    true,
    false,
    false,
  ]);
  const stored = JSON.parse(
    (await AsyncStorage.getItem(PROFILES_STORAGE_KEY))!,
  );
  expect(stored.profiles).toHaveLength(3);
  expect(stored.profiles[2]).toMatchObject({
    name: 'My VPN',
    server: expect.objectContaining({ login: 'bob', ipAddress: '10.9.9.9' }),
  });

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('back on an untouched create draft exits silently; footer is Create only', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await openCreateEditor(renderer);
  // Create mode footer: Create only — no Cancel, no Delete (issue #71).
  expect(pressableByTestID(renderer, 'profile-create')).toBeTruthy();
  expect(pressableByTestID(renderer, 'profile-cancel')).toBeNull();
  expect(pressableByTestID(renderer, 'profile-delete')).toBeNull();
  await pressBack();

  expect(renderedText(renderer)).not.toContain('Discard changes?');
  expect(renderedText(renderer)).not.toContain('Configurations');
  expect(profileRows(renderer)).toHaveLength(2);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('back on a dirty draft asks; Keep Editing stays, Discard drops it', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await openCreateEditor(renderer);
  await press(renderer, 'profile-advanced-toggle');
  await ReactTestRenderer.act(async () => {
    textInputByTestID(renderer, 'profile-name-input').props.onChangeText(
      'Half-typed',
    );
  });
  await pressBack();

  expect(renderedText(renderer)).toContain('Discard changes?');
  expect(renderedText(renderer)).toContain('Your changes will not be saved.');
  await press(renderer, 'alert-button-Keep Editing');
  // Still editing: the screen and the typed name survive.
  expect(renderedText(renderer)).toContain('Configurations');
  expect(textInputByTestID(renderer, 'profile-name-input').props.value).toBe(
    'Half-typed',
  );

  await pressBack();
  await press(renderer, 'alert-button-Discard');
  // Editor closed; nothing was created or persisted.
  expect(renderedText(renderer)).not.toContain('Configurations');
  expect(profileRows(renderer)).toHaveLength(2);
  expect(
    JSON.parse((await AsyncStorage.getItem(PROFILES_STORAGE_KEY))!).profiles,
  ).toHaveLength(2);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('a bad link in create mode shows the alert modal and touches nothing', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await openCreateEditor(renderer);
  await ReactTestRenderer.act(async () => {
    textInputByTestID(renderer, 'profile-link-input').props.onChangeText(
      'https://not-a-profile-link',
    );
  });
  await press(renderer, 'profile-link-apply');

  // The custom modal renders in the tree — no Alert.alert anywhere.
  expect(renderedText(renderer)).toContain('Profile Link failed');
  await press(renderer, 'alert-button-OK');
  expect(renderedText(renderer)).not.toContain('Profile Link failed');
  // Advanced stays collapsed and the Profile List is untouched.
  expect(textInputByTestID(renderer, 'profile-name-input')).toBeUndefined();
  expect(profileRows(renderer)).toHaveLength(2);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('edit mode has no link input and opens Advanced expanded', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await press(renderer, 'profile-edit-b');

  expect(textInputByTestID(renderer, 'profile-link-input')).toBeUndefined();
  expect(textInputByTestID(renderer, 'profile-name-input').props.value).toBe(
    'Beta',
  );

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('edit mode holds a draft: rename reaches the card and storage only on Save', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await press(renderer, 'profile-edit-b');

  const nameInput = textInputByTestID(renderer, 'profile-name-input');
  expect(nameInput.props.value).toBe('Beta');
  await ReactTestRenderer.act(async () => {
    nameInput.props.onChangeText('Backup');
  });

  // The rename lives in the draft: the card beneath still says Beta and
  // storage is untouched.
  expect(renderedText(renderer)).toContain('Beta');
  expect(renderedText(renderer)).not.toContain('Backup');
  expect(
    JSON.parse((await AsyncStorage.getItem(PROFILES_STORAGE_KEY))!).profiles[1]
      .name,
  ).toBe('Beta');

  // Delete and Save sit outside Advanced: collapsing it keeps them around.
  await press(renderer, 'profile-advanced-toggle');
  expect(pressableByTestID(renderer, 'profile-save')).toBeTruthy();
  expect(pressableByTestID(renderer, 'profile-delete')).toBeTruthy();
  expect(pressableByTestID(renderer, 'profile-cancel')).toBeNull();

  await press(renderer, 'profile-save');

  // Editor closed; the committed rename is on the card and persisted.
  expect(renderedText(renderer)).not.toContain('Configurations');
  expect(renderedText(renderer)).toContain('Backup');
  expect(renderedText(renderer)).not.toContain('Beta');
  // Editing is not selecting: Alpha keeps the selection.
  expect(
    profileRows(renderer).map(row => row.props.accessibilityState.selected),
  ).toEqual([true, false]);
  expect(
    JSON.parse((await AsyncStorage.getItem(PROFILES_STORAGE_KEY))!).profiles[1]
      .name,
  ).toBe('Backup');

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('saved edits land on that profile only; tunnel still starts from the Selected Profile', async () => {
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
  await press(renderer, 'profile-save');

  const stored = JSON.parse(
    (await AsyncStorage.getItem(PROFILES_STORAGE_KEY))!,
  );
  expect(stored.profiles[1].server.login).toBe('edited-user');
  expect(stored.profiles[0].server.login).toBe('user');

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

test('Save is disabled while the edit draft violates Profile Completeness', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await press(renderer, 'profile-edit-b');
  const ipInput = renderer.root.findAll(
    node =>
      node.props.placeholder === 'Server IP Address' &&
      typeof node.props.onChangeText === 'function',
  )[0];
  await ReactTestRenderer.act(async () => {
    ipInput.props.onChangeText('');
  });
  expect(pressableByTestID(renderer, 'profile-save')!.props.disabled).toBe(
    true,
  );

  await ReactTestRenderer.act(async () => {
    ipInput.props.onChangeText('10.0.0.2');
  });
  expect(pressableByTestID(renderer, 'profile-save')!.props.disabled).toBe(
    false,
  );

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('Save on an edit draft is disabled until touched (issue #71)', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await press(renderer, 'profile-edit-b');
  // The seeded profile is complete, but the draft is untouched: Save waits.
  expect(pressableByTestID(renderer, 'profile-save')!.props.disabled).toBe(
    true,
  );

  // Any edit flips the touched flag — even one restoring the same value
  // (touched semantics, not value-diff).
  const nameInput = textInputByTestID(renderer, 'profile-name-input');
  await ReactTestRenderer.act(async () => {
    nameInput.props.onChangeText('Beta');
  });
  expect(pressableByTestID(renderer, 'profile-save')!.props.disabled).toBe(
    false,
  );

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('edit back: clean exit is silent; dirty asks and Discard restores nothing', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  // Untouched draft: back closes without a confirmation.
  await press(renderer, 'profile-edit-b');
  await pressBack();
  expect(renderedText(renderer)).not.toContain('Discard changes?');
  expect(renderedText(renderer)).not.toContain('Configurations');

  // Dirty draft: back asks; Discard drops the draft, storage keeps the
  // old values (nothing was written to restore).
  await press(renderer, 'profile-edit-b');
  const username = renderer.root.findAll(
    node =>
      node.props.placeholder === 'Username' &&
      typeof node.props.onChangeText === 'function',
  )[0];
  await ReactTestRenderer.act(async () => {
    username.props.onChangeText('typo-user');
  });
  await pressBack();
  expect(renderedText(renderer)).toContain('Discard changes?');
  await press(renderer, 'alert-button-Discard');

  expect(renderedText(renderer)).not.toContain('Configurations');
  expect(
    JSON.parse((await AsyncStorage.getItem(PROFILES_STORAGE_KEY))!).profiles[1]
      .server.login,
  ).toBe('user');

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test("saving the Running tunnel's profile raises the applies-on-next-connect Toast", async () => {
  jest.useFakeTimers();
  try {
    await seedTwoProfiles();
    const renderer = await renderApp();

    await ReactTestRenderer.act(async () => {
      emitNativeState('connected');
    });
    // Edit the Selected (Running) profile — allowed.
    await press(renderer, 'profile-edit-a');
    const username = renderer.root.findAll(
      node =>
        node.props.placeholder === 'Username' &&
        typeof node.props.onChangeText === 'function',
    )[0];
    await ReactTestRenderer.act(async () => {
      username.props.onChangeText('next-user');
    });
    await press(renderer, 'profile-save');

    // The change is persisted, announced, and the live tunnel untouched.
    expect(renderedText(renderer)).toContain('Changes apply on next connect');
    expect(renderer.root.findByProps({ testID: 'app-toast' })).toBeTruthy();
    expect(
      JSON.parse((await AsyncStorage.getItem(PROFILES_STORAGE_KEY))!)
        .profiles[0].server.login,
    ).toBe('next-user');
    expect(VpnClient.stop).not.toHaveBeenCalled();
    expect(VpnClient.start).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(TOAST_DURATION_MS);
    });
    expect(renderedText(renderer)).not.toContain(
      'Changes apply on next connect',
    );

    await ReactTestRenderer.act(async () => {
      emitNativeState('disconnected');
    });
    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });
  } finally {
    jest.useRealTimers();
  }
});

test('deleting the Selected Profile is blocked while Running', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await ReactTestRenderer.act(async () => {
    emitNativeState('connected');
  });
  await press(renderer, 'profile-edit-a');
  await press(renderer, 'profile-delete');

  const text = renderedText(renderer);
  expect(text).toContain('Cannot delete');
  expect(text).toContain('Stop the tunnel to delete the Selected Profile.');
  expect(profileRows(renderer)).toHaveLength(2);

  await press(renderer, 'alert-button-OK');
  await ReactTestRenderer.act(async () => {
    emitNativeState('disconnected');
  });
  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});

test('deleting the Selected Profile while Stopped reselects the other', async () => {
  await seedTwoProfiles();
  const renderer = await renderApp();

  await press(renderer, 'profile-edit-a');
  await press(renderer, 'profile-delete');

  // The confirmation modal offers a destructive Delete.
  expect(renderedText(renderer)).toContain('Delete "Alpha"?');
  await press(renderer, 'alert-button-Delete');

  const rows = profileRows(renderer);
  expect(rows).toHaveLength(1);
  expect(rows[0].props.testID).toBe('profile-row-b');
  expect(rows[0].props.accessibilityState.selected).toBe(true);
  // The editor for the deleted profile has been popped.
  expect(renderedText(renderer)).not.toContain('Configurations');

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
  await seedLogSettings();
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

  // Appearance starts collapsed (issue #68); open it to reach the picker.
  await press(renderer, 'settings-section-appearance');
  // One segmented control (issue #81): System starts checked.
  expect(
    pressableByTestID(renderer, 'settings-theme-system')!.props
      .accessibilityState.checked,
  ).toBe(true);
  await press(renderer, 'settings-theme-dark');

  // Theme applied, navigation did not reset to Dashboard.
  let text = renderedText(renderer);
  expect(
    pressableByTestID(renderer, 'settings-theme-dark')!.props.accessibilityState
      .checked,
  ).toBe(true);
  expect(
    pressableByTestID(renderer, 'settings-theme-system')!.props
      .accessibilityState.checked,
  ).toBe(false);
  // Persistence unchanged: the preference lands under the same key.
  expect(await AsyncStorage.getItem('@twohops/theme/preference')).toBe('dark');
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
  // Tunnel Session state survived too: the FAB still offers Stop.
  expect(fab(renderer)!.props.accessibilityLabel).toBe('Stop tunnel');

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

  // Issue #68: Appearance starts collapsed, About starts expanded.
  let text = renderedText(renderer);
  expect(text).toContain('Appearance');
  expect(pressableByTestID(renderer, 'settings-theme-system')).toBeNull();
  const appearanceHeader = pressableByTestID(
    renderer,
    'settings-section-appearance',
  )!;
  expect(appearanceHeader.props.accessibilityState.expanded).toBe(false);
  expect(
    pressableByTestID(renderer, 'settings-section-about')!.props
      .accessibilityState.expanded,
  ).toBe(true);
  // About section (issue #50): version + build from CI env, core pin, licenses.
  expect(text).toContain('About');
  expect(text).toContain(`${require('../package.json').version} (2025010100)`);
  expect(text).toContain('Core Version');
  expect(text).toContain('1.1.3');
  expect(text).toContain('App License');
  expect(text).toContain('Core License');
  expect(text).toContain('Apache-2.0');
  // Developer copy (issue #68).
  expect(text).toContain('developed by Min');
  expect(text).toContain('AdGuard');
  expect(text).toContain('TrustTunnel');

  // Expanding Appearance reveals the theme picker.
  await press(renderer, 'settings-section-appearance');
  expect(pressableByTestID(renderer, 'settings-theme-system')).not.toBeNull();

  // Leave and return: bottom tabs keep the screen mounted, but issue #68
  // says collapse defaults reset on every visit.
  const dashboardTab = tabButtons(renderer).find(node =>
    node.props.accessibilityLabel.startsWith('Dashboard'),
  )!;
  await ReactTestRenderer.act(async () => {
    dashboardTab.props.onPress();
  });
  await ReactTestRenderer.act(async () => {
    settingsTab.props.onPress();
  });
  expect(
    pressableByTestID(renderer, 'settings-section-appearance')!.props
      .accessibilityState.expanded,
  ).toBe(false);
  expect(
    pressableByTestID(renderer, 'settings-section-about')!.props
      .accessibilityState.expanded,
  ).toBe(true);

  await ReactTestRenderer.act(async () => {
    renderer.unmount();
  });
});
