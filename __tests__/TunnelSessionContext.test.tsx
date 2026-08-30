import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  TunnelSessionProvider,
  useTunnelSession,
} from '../src/context/TunnelSessionContext';
import type {
  SessionSnapshot,
  TunnelSession,
} from '../src/services/tunnelSession';

// Not exercising the real adapter; keep the native registry out of this test.
jest.mock('../src/services/vpn', () => ({ VpnClient: {} }));

function fakeSession() {
  let snapshot: SessionSnapshot = { state: 'disconnected', lastError: null };
  const listeners = new Set<() => void>();
  const session: TunnelSession = {
    getSnapshot: () => snapshot,
    subscribe: l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    connect: jest.fn(),
    disconnect: jest.fn(),
    onDebug: () => () => {},
  };
  return {
    session,
    setState: (state: SessionSnapshot['state']) => {
      snapshot = { ...snapshot, state };
      listeners.forEach(l => l());
    },
  };
}

type Ctx = ReturnType<typeof useTunnelSession>;

async function mount(session: TunnelSession) {
  const ref: { current: Ctx | null } = { current: null };
  function Probe() {
    ref.current = useTunnelSession();
    return null;
  }
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(
      <TunnelSessionProvider session={session}>
        <Probe />
      </TunnelSessionProvider>,
    );
  });
  return () => ref.current as Ctx;
}

class Catch extends React.Component<
  { children: React.ReactNode; onError: (e: Error) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

test('hook throws outside provider', async () => {
  function Probe() {
    useTunnelSession();
    return null;
  }
  const onError = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(
      <Catch onError={onError}>
        <Probe />
      </Catch>,
    );
  });
  expect(onError.mock.calls[0][0].message).toBe(
    'useTunnelSession must be used inside TunnelSessionProvider.',
  );
});

test('re-renders on snapshot change', async () => {
  const { session, setState } = fakeSession();
  const ctx = await mount(session);
  expect(ctx().snapshot.state).toBe('disconnected');
  await ReactTestRenderer.act(async () => {
    setState('connecting');
  });
  expect(ctx().snapshot.state).toBe('connecting');
  expect(ctx().session).toBe(session);
});
