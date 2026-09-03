import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FlatList, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LogsScreen from '../src/screens/LogsScreen';
import { LogsProvider } from '../src/context/LogsContext';
import { LogSettingsProvider } from '../src/context/LogSettingsContext';
import { TunnelSessionProvider } from '../src/context/TunnelSessionContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { SetupProfileProvider } from '../src/context/SetupProfileContext';
import { ToastProvider } from '../src/components/AppToast';
import { createLogBuffer } from '../src/services/logBuffer';
import PressableScale from '../src/components/PressableScale';
import { PROFILES_STORAGE_KEY } from '../src/services/profileStore';
import type { DebugEntry, TunnelSession } from '../src/services/tunnelSession';
import type { QueryLogRow } from '../src/types';

// Not exercising the real adapter; keep the native registry out of this test.
jest.mock('../src/services/vpn', () => ({ VpnClient: {} }));
// Direct Probe (#99) hits the network; the screen only needs its verdict.
jest.mock('../src/services/directProbe', () => ({
  probeDirect: jest.fn(),
}));
import { probeDirect } from '../src/services/directProbe';
const probeMock = probeDirect as jest.MockedFunction<typeof probeDirect>;
jest.mock('react-native-config', () => ({
  ENV_SERVER_NAME: 'env-server',
  ENV_PROTOCOL: 'QUIC',
  ENV_DNS_SERVERS: '',
}));

const snapshot = { state: 'disconnected', lastError: null } as const;
const session: TunnelSession = {
  getSnapshot: () => snapshot,
  subscribe: () => () => {},
  connect: jest.fn(),
  disconnect: jest.fn(),
  onDebug: () => () => {},
};

function trafficRow(
  stamp: Date,
  overrides: Partial<QueryLogRow> = {},
): QueryLogRow {
  return {
    action: 'bypass',
    protocol: 'tcp',
    source: '10.0.0.2:1234',
    destination: '1.2.3.4:443',
    domain: 'example.com',
    stamp,
    ...overrides,
  };
}

function profileList(
  routingMode: 'selective' | 'general',
  localRulesText = '',
) {
  return {
    version: 1,
    selectedId: 'p1',
    profiles: [
      {
        id: 'p1',
        name: 'Test',
        version: 1,
        server: {
          name: 'Test',
          ipAddress: '1.1.1.1',
          domain: 'vpn.test',
          login: 'u',
          password: 'p',
          vpnProtocol: 'QUIC',
        },
        dnsServers: [],
        routingMode,
        localRulesText,
        remoteRulesURL: '',
        importedRules: [],
        importedAt: null,
      },
    ],
  };
}

async function mount(
  trafficLogs = createLogBuffer<QueryLogRow>({ cap: 10 }),
  debugLogs = createLogBuffer<DebugEntry>({ cap: 10 }),
) {
  await AsyncStorage.setItem(
    '@twohops/logs/settings',
    JSON.stringify({ trafficLoggingEnabled: true, debugLoggingEnabled: true }),
  );
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <ToastProvider>
          <SetupProfileProvider>
            <TunnelSessionProvider session={session}>
              <LogSettingsProvider>
                <LogsProvider trafficLogs={trafficLogs} debugLogs={debugLogs}>
                  <LogsScreen />
                </LogsProvider>
              </LogSettingsProvider>
            </TunnelSessionProvider>
          </SetupProfileProvider>
        </ToastProvider>
      </ThemeProvider>,
    );
  });
  // The reanimated mock renders Animated.View as a plain View, so a row's
  // `entering` prop is observable: set only on rows that animate in.
  const rowsAnimating = () =>
    renderer.root.findAll(
      node => node.props.entering !== undefined && !node.parent?.props.entering,
    ).length;
  const rowsShown = () => renderer.root.findByType(FlatList).props.data.length;
  const press = (testID: string) =>
    ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID }).props.onPress();
    });
  const addButtons = () =>
    renderer.root
      .findAllByType(PressableScale)
      .filter(node => String(node.props.testID).startsWith('logs-add-rule-'));
  const toastText = () =>
    renderer.root
      .findAll(node => node.props.testID === 'app-toast')
      .map(node => node.findAllByType(Text)[0]?.props.children)[0];
  const buttons = () =>
    renderer.root
      .findAllByType(PressableScale)
      .filter(node =>
        /^logs-(add-rule|test-direct)-/.test(String(node.props.testID)),
      );
  const texts = () =>
    renderer.root
      .findAllByType(Text)
      .map(node => String(node.props.children))
      .flat();
  const scrollTo = (y: number, height = 600) =>
    ReactTestRenderer.act(async () => {
      renderer.root.findByType(FlatList).props.onScroll({
        nativeEvent: { contentOffset: { y }, layoutMeasurement: { height } },
      });
    });
  const scrollTopButton = () =>
    renderer.root
      .findAllByType(PressableScale)
      .filter(node => node.props.testID === 'logs-scroll-top');
  return {
    rowsAnimating,
    rowsShown,
    press,
    addButtons,
    buttons,
    toastText,
    texts,
    scrollTo,
    scrollTopButton,
  };
}

async function seedProfiles(...args: Parameters<typeof profileList>) {
  await AsyncStorage.setItem(
    PROFILES_STORAGE_KEY,
    JSON.stringify(profileList(...args)),
  );
}

beforeEach(() => AsyncStorage.clear());

test('rows already buffered mount in place; rows appended after open animate (#97)', async () => {
  const trafficLogs = createLogBuffer<QueryLogRow>({ cap: 10 });
  const before = new Date(Date.now() - 1000);
  trafficLogs.append(trafficRow(before));
  trafficLogs.append(trafficRow(before));
  const { rowsAnimating, rowsShown } = await mount(trafficLogs);
  expect(rowsShown()).toBe(2);
  expect(rowsAnimating()).toBe(0);

  await ReactTestRenderer.act(async () => {
    trafficLogs.append(trafficRow(new Date(Date.now() + 1000)));
  });
  expect(rowsShown()).toBe(3);
  expect(rowsAnimating()).toBe(1);
});

test('a row animates once: remounting the list does not replay it (#97)', async () => {
  const trafficLogs = createLogBuffer<QueryLogRow>({ cap: 10 });
  const { rowsAnimating, rowsShown, press } = await mount(trafficLogs);
  await ReactTestRenderer.act(async () => {
    trafficLogs.append(trafficRow(new Date(Date.now() + 1000)));
  });
  expect(rowsAnimating()).toBe(1);

  // Segment switch remounts the FlatList (FlatList virtualisation does the
  // same to rows scrolled back into view); neither may replay the entry.
  await press('logs-segment-debug');
  await press('logs-segment-traffic');
  expect(rowsShown()).toBe(1);
  expect(rowsAnimating()).toBe(0);
});

test('empty buffer shows the empty copy', async () => {
  const { rowsShown } = await mount();
  expect(rowsShown()).toBe(0);
});

describe('add bypassed domain to Local Rules (#98)', () => {
  const now = () => new Date();

  test('selective mode: Add appears after a failed probe; press appends the collapsed domain and toasts', async () => {
    await seedProfiles('selective', 'a.com');
    const trafficLogs = createLogBuffer<QueryLogRow>({ cap: 10 });
    trafficLogs.append(trafficRow(now(), { domain: 'www.facebook.com' }));
    const { addButtons, press, toastText, texts } = await mount(trafficLogs);
    // Idle row: only the probe (#103).
    expect(addButtons()).toHaveLength(0);
    expect(texts()).toContain('Test direct');

    probeMock.mockResolvedValueOnce('failed');
    await press('logs-test-direct-www.facebook.com');
    expect(addButtons()).toHaveLength(1);
    expect(texts()).toContain('Add to Local Rules');
    expect(texts()).not.toContain('Test direct');

    await press('logs-add-rule-facebook.com');
    const stored = JSON.parse(
      (await AsyncStorage.getItem(PROFILES_STORAGE_KEY)) ?? '{}',
    );
    expect(stored.profiles[0].localRulesText).toBe('a.com\nfacebook.com');
    expect(toastText()).toBe('Added. Reconnect to apply.');
    // Now listed: the row shows no control at all.
    expect(addButtons()).toHaveLength(0);
    expect(texts()).not.toContain('Test direct');
    expect(texts()).not.toContain('Direct failed.');
  });

  test('hidden for tunnel rows, listed domains, and general mode', async () => {
    await seedProfiles('selective', 'listed.com');
    const trafficLogs = createLogBuffer<QueryLogRow>({ cap: 10 });
    trafficLogs.append(
      trafficRow(now(), { action: 'tunnel', domain: 'x.com' }),
    );
    trafficLogs.append(trafficRow(now(), { domain: 'cdn.listed.com' }));
    const { texts } = await mount(trafficLogs);
    expect(texts()).not.toContain('Test direct');

    await seedProfiles('general');
    const generalLogs = createLogBuffer<QueryLogRow>({ cap: 10 });
    generalLogs.append(trafficRow(now(), { domain: 'y.com' }));
    const general = await mount(generalLogs);
    expect(general.texts()).not.toContain('Test direct');
  });
});

describe('Test direct probe for a bypassed domain (#99)', () => {
  test('one control per row: probe, then on failure Add; on success only a verdict', async () => {
    await seedProfiles('selective');
    const trafficLogs = createLogBuffer<QueryLogRow>({ cap: 10 });
    trafficLogs.append(trafficRow(new Date(), { domain: 'www.facebook.com' }));
    trafficLogs.append(trafficRow(new Date(), { domain: 'www.x.com' }));
    const { press, addButtons, texts, buttons } = await mount(trafficLogs);
    expect(texts().filter(t => t === 'Test direct')).toHaveLength(2);
    expect(addButtons()).toHaveLength(0);

    probeMock.mockResolvedValueOnce('failed');
    await press('logs-test-direct-www.facebook.com');
    expect(probeMock).toHaveBeenCalledWith('www.facebook.com');
    expect(texts()).toContain('Direct failed.');
    expect(addButtons()).toHaveLength(1);
    // Other row untouched.
    expect(texts().filter(t => t === 'Test direct')).toHaveLength(1);

    probeMock.mockResolvedValueOnce('works');
    await press('logs-test-direct-www.x.com');
    expect(texts()).toContain('Direct works.');
    expect(texts()).not.toContain('Test direct');
    // Verdict only: one control left in the list, the failed row's Add.
    expect(buttons()).toHaveLength(1);

    // Clear drops the rows and their verdicts.
    await press('logs-clear');
    await ReactTestRenderer.act(async () => {
      trafficLogs.append(
        trafficRow(new Date(), { domain: 'www.facebook.com' }),
      );
    });
    expect(texts()).not.toContain('Direct works.');
    expect(texts()).toContain('Test direct');
  });

  test('not offered where Add is not offered (tunnel rows, general mode)', async () => {
    await seedProfiles('general');
    const trafficLogs = createLogBuffer<QueryLogRow>({ cap: 10 });
    trafficLogs.append(trafficRow(new Date(), { domain: 'y.com' }));
    const { texts } = await mount(trafficLogs);
    expect(texts()).not.toContain('Test direct');
  });
});

describe('scroll to top (#103)', () => {
  test('hidden near the top; shown past one screen; tap scrolls to offset 0', async () => {
    const trafficLogs = createLogBuffer<QueryLogRow>({ cap: 10 });
    trafficLogs.append(trafficRow(new Date()));
    const { scrollTo, scrollTopButton, press } = await mount(trafficLogs);
    const scrollToOffset = jest
      .spyOn(FlatList.prototype, 'scrollToOffset')
      .mockImplementation(() => {});
    expect(scrollTopButton()).toHaveLength(0);

    await scrollTo(300);
    expect(scrollTopButton()).toHaveLength(0);

    await scrollTo(1200);
    expect(scrollTopButton()).toHaveLength(1);
    await press('logs-scroll-top');
    expect(scrollToOffset).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0 }),
    );

    await scrollTo(0);
    expect(scrollTopButton()).toHaveLength(0);
    scrollToOffset.mockRestore();
  });

  test('debug tab has it too; hidden once the list is cleared', async () => {
    const debugLogs = createLogBuffer<DebugEntry>({ cap: 10 });
    debugLogs.append({ at: new Date(), message: 'hello' });
    const { press, scrollTo, scrollTopButton } = await mount(
      undefined,
      debugLogs,
    );
    await press('logs-segment-debug');
    await scrollTo(1200);
    expect(scrollTopButton()).toHaveLength(1);
    // Clear empties the list without a scroll event.
    await press('logs-clear');
    expect(scrollTopButton()).toHaveLength(0);
  });
});
