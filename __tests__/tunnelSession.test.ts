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
  let startImpl: () => Promise<void> = () => Promise.resolve();
  const port: TunnelNativePort = {
    start: i => {
      startCalls.push(i);
      return startImpl();
    },
    stop: () => Promise.resolve(),
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
