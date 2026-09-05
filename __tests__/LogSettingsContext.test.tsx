import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LogSettingsProvider,
  useLogSettings,
} from '../src/context/LogSettingsContext';

type Ctx = ReturnType<typeof useLogSettings>;

async function mount() {
  const ref: { current: Ctx | null } = { current: null };
  function Probe() {
    ref.current = useLogSettings();
    return null;
  }
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <LogSettingsProvider>
        <Probe />
      </LogSettingsProvider>,
    );
  });
  return {
    ctx: () => ref.current!,
    unmount: () => renderer.unmount(),
  };
}

beforeEach(() => AsyncStorage.clear());

test('both toggles default OFF', async () => {
  const { ctx } = await mount();
  expect(ctx().debugLoggingEnabled).toBe(false);
  expect(ctx().trafficLoggingEnabled).toBe(false);
});

test('a toggled setting survives a remount (persistence)', async () => {
  const first = await mount();
  await ReactTestRenderer.act(async () => {
    first.ctx().setTrafficLoggingEnabled(true);
  });
  first.unmount();

  const second = await mount();
  expect(second.ctx().trafficLoggingEnabled).toBe(true);
  expect(second.ctx().debugLoggingEnabled).toBe(false);
});

test('garbage in storage falls back to defaults', async () => {
  await AsyncStorage.setItem('@twohops/logs/settings', 'not json');
  const { ctx } = await mount();
  expect(ctx().debugLoggingEnabled).toBe(false);
  expect(ctx().trafficLoggingEnabled).toBe(false);
});

test('Core Logging defaults OFF at info; toggle and level persist (#136)', async () => {
  const first = await mount();
  expect(first.ctx().coreLoggingEnabled).toBe(false);
  expect(first.ctx().coreLogLevel).toBe('info');
  await ReactTestRenderer.act(async () => {
    first.ctx().setCoreLoggingEnabled(true);
    first.ctx().setCoreLogLevel('debug');
  });
  first.unmount();

  const second = await mount();
  expect(second.ctx().coreLoggingEnabled).toBe(true);
  expect(second.ctx().coreLogLevel).toBe('debug');
});

test('an unknown stored core level falls back to info', async () => {
  await AsyncStorage.setItem(
    '@twohops/logs/settings',
    JSON.stringify({ coreLoggingEnabled: true, coreLogLevel: 'critical' }),
  );
  const { ctx } = await mount();
  expect(ctx().coreLogLevel).toBe('info');
});
