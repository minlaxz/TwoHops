import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LogsScreen from '../src/screens/LogsScreen';
import { LogsProvider } from '../src/context/LogsContext';
import { LogSettingsProvider } from '../src/context/LogSettingsContext';
import { TunnelSessionProvider } from '../src/context/TunnelSessionContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { createLogBuffer } from '../src/services/logBuffer';
import type { DebugEntry, TunnelSession } from '../src/services/tunnelSession';
import type { QueryLogRow } from '../src/types';

// Not exercising the real adapter; keep the native registry out of this test.
jest.mock('../src/services/vpn', () => ({ VpnClient: {} }));

const snapshot = { state: 'disconnected', lastError: null } as const;
const session: TunnelSession = {
  getSnapshot: () => snapshot,
  subscribe: () => () => {},
  connect: jest.fn(),
  disconnect: jest.fn(),
  onDebug: () => () => {},
};

function trafficRow(stamp: Date): QueryLogRow {
  return {
    action: 'bypass',
    protocol: 'tcp',
    source: '10.0.0.2:1234',
    destination: '1.2.3.4:443',
    domain: 'example.com',
    stamp,
  };
}

async function mount(trafficLogs = createLogBuffer<QueryLogRow>({ cap: 10 })) {
  await AsyncStorage.setItem(
    '@twohops/logs/settings',
    JSON.stringify({ trafficLoggingEnabled: true, debugLoggingEnabled: true }),
  );
  const debugLogs = createLogBuffer<DebugEntry>({ cap: 10 });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <ThemeProvider>
        <TunnelSessionProvider session={session}>
          <LogSettingsProvider>
            <LogsProvider trafficLogs={trafficLogs} debugLogs={debugLogs}>
              <LogsScreen />
            </LogsProvider>
          </LogSettingsProvider>
        </TunnelSessionProvider>
      </ThemeProvider>,
    );
  });
  // The reanimated mock renders Animated.View as a plain View, so a row's
  // `entering` prop is observable: set only on rows that animate in.
  const rowsAnimating = () =>
    renderer.root
      .findAll(node => node.props.entering !== undefined && !node.parent?.props.entering)
      .length;
  const rowsShown = () =>
    renderer.root.findByType(FlatList).props.data.length;
  const press = (testID: string) =>
    ReactTestRenderer.act(async () => {
      renderer.root.findByProps({ testID }).props.onPress();
    });
  return { rowsAnimating, rowsShown, press };
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
