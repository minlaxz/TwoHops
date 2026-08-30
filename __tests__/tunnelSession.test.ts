import {
  createTunnelSession,
  type TunnelNativePort,
} from '../src/services/tunnelSession';
import type { VpnManagerState, VpnStartInput } from '../src/types';

const input: VpnStartInput = {
  server: {
    name: 's',
    ipAddress: '1.2.3.4',
    domain: 'd',
    login: 'l',
    password: 'p',
    vpnProtocol: 'QUIC',
    dnsServers: [],
  },
  routing: { mode: 'general', rules: [] },
};

function fakePort(initial: VpnManagerState = 'disconnected') {
  let listener: ((s: VpnManagerState) => void) | null = null;
  const probes: VpnManagerState[] = [];
  const startCalls: VpnStartInput[] = [];
  const stopCalls: true[] = [];
  let startImpl: () => Promise<void> = () => Promise.resolve();
  const port: TunnelNativePort = {
    start: i => {
      startCalls.push(i);
      return startImpl();
    },
    stop: () => {
      stopCalls.push(true);
      return Promise.resolve();
    },
    getCurrentState: () => Promise.resolve(probes.shift() ?? initial),
    onState: l => {
      listener = l;
      return () => {
        listener = null;
      };
    },
  };
  return {
    port,
    probes,
    startCalls,
    stopCalls,
    emit: (s: VpnManagerState) => listener?.(s),
    rejectStart: (msg: string) => {
      startImpl = () => Promise.reject(new Error(msg));
    },
  };
}

const settle = () => new Promise(r => setTimeout(r, 20));

function make(initial?: VpnManagerState) {
  const fake = fakePort(initial);
  const session = createTunnelSession(fake.port, { probeDelays: [0, 0, 0] });
  const debug: string[] = [];
  session.onDebug(e => debug.push(e.message));
  return { ...fake, session, debug };
}

test('seeds state from native on creation', async () => {
  const { session } = make('connected');
  expect(session.getSnapshot().state).toBe('disconnected');
  await settle();
  expect(session.getSnapshot().state).toBe('connected');
});

test('seed read that resolves after connect does not clobber connecting', async () => {
  const { session, startCalls, probes } = make('disconnected');
  probes.push('connecting', 'connecting', 'connecting');
  session.connect(input); // before the seed read resolves
  await settle();
  session.connect(input);
  expect(startCalls).toHaveLength(1);
});

test('connect: connecting synchronously, start once, probes stop early on connected', async () => {
  const { session, probes, startCalls, debug } = make();
  await settle();
  const seen: string[] = [];
  session.subscribe(() => seen.push(session.getSnapshot().state));
  probes.push('connecting', 'connected', 'disconnected');

  session.connect(input);
  expect(session.getSnapshot().state).toBe('connecting');
  session.connect(input); // in flight → no-op
  await settle();

  expect(startCalls).toHaveLength(1);
  expect(session.getSnapshot()).toEqual({
    state: 'connected',
    lastError: null,
  });
  expect(probes).toEqual(['disconnected']); // third probe never read
  expect(seen).toEqual(['connecting', 'connected']);
  expect(debug.some(m => m.includes('connecting'))).toBe(true);
  expect(debug.some(m => m.includes('connected'))).toBe(true);
});

test('native event during reconciliation ends it and wins', async () => {
  const { session, probes, emit } = make();
  await settle();
  probes.push('connecting', 'connecting', 'connecting');
  session.connect(input);
  emit('connected');
  await settle();
  expect(session.getSnapshot().state).toBe('connected');
  expect(probes).toHaveLength(3); // no probe consumed after the event
});

test('start rejection after a native event does not overwrite it', async () => {
  const { session, emit, rejectStart } = make();
  await settle();
  rejectStart('late');
  session.connect(input);
  emit('connected');
  await settle();
  expect(session.getSnapshot()).toEqual({
    state: 'connected',
    lastError: null,
  });
});

test('start rejection → disconnected + start-failed', async () => {
  const { session, rejectStart } = make();
  await settle();
  rejectStart('denied');
  session.connect(input);
  await settle();
  expect(session.getSnapshot()).toEqual({
    state: 'disconnected',
    lastError: { code: 'start-failed', message: 'denied' },
  });
});

test('final probe disconnected → disconnected + start-not-confirmed', async () => {
  const { session, probes } = make();
  await settle();
  probes.push('connecting', 'connecting', 'disconnected');
  session.connect(input);
  await settle();
  expect(session.getSnapshot()).toEqual({
    state: 'disconnected',
    lastError: {
      code: 'start-not-confirmed',
      message: 'The tunnel never confirmed the start.',
    },
  });
});

test('final probe still connecting → stays connecting until native event', async () => {
  const { session, probes, emit } = make();
  await settle();
  probes.push('connecting', 'connecting', 'connecting');
  session.connect(input);
  await settle();
  expect(session.getSnapshot()).toEqual({
    state: 'connecting',
    lastError: null,
  });
  emit('connected');
  expect(session.getSnapshot().state).toBe('connected');
});

test('connect while not disconnected is a no-op', async () => {
  const { session, startCalls } = make('connected');
  await settle();
  session.connect(input);
  expect(startCalls).toHaveLength(0);
});

test('disconnect during connecting → disconnecting, stop, reconciles to disconnected', async () => {
  const { session, probes, stopCalls } = make();
  await settle();
  probes.push('connecting', 'connecting', 'connecting');
  session.connect(input);
  session.disconnect();
  expect(session.getSnapshot().state).toBe('disconnecting');
  expect(stopCalls).toHaveLength(1);
  probes.length = 0;
  probes.push('disconnected');
  await settle();
  expect(session.getSnapshot()).toEqual({
    state: 'disconnected',
    lastError: null,
  });
});

test('next command clears lastError', async () => {
  const { session, rejectStart, probes } = make();
  await settle();
  rejectStart('denied');
  session.connect(input);
  await settle();
  expect(session.getSnapshot().lastError?.code).toBe('start-failed');
  probes.push('connecting', 'connecting', 'connecting');
  session.connect(input);
  expect(session.getSnapshot().lastError).toBeNull();
});

test('disconnect (cancel) also clears lastError', async () => {
  const { session, probes, emit, rejectStart } = make();
  await settle();
  rejectStart('denied');
  session.connect(input);
  await settle();
  expect(session.getSnapshot().lastError?.code).toBe('start-failed');
  emit('connecting'); // native reports a late start on its own
  probes.push('disconnected');
  session.disconnect();
  expect(session.getSnapshot()).toEqual({
    state: 'disconnecting',
    lastError: null,
  });
  await settle();
  expect(session.getSnapshot().state).toBe('disconnected');
});
