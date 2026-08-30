import type { VpnManagerState, VpnStartInput } from '../types';

/** The four native operations the Tunnel Session depends on. */
export type TunnelNativePort = {
  start(input: VpnStartInput): Promise<void>;
  stop(): Promise<void>;
  getCurrentState(): Promise<VpnManagerState>;
  onState(listener: (state: VpnManagerState) => void): () => void;
};

export type SessionState = VpnManagerState | 'disconnecting';
export type SessionErrorCode =
  | 'start-not-confirmed'
  | 'start-failed'
  | 'stop-failed';
export type SessionError = { code: SessionErrorCode; message: string };
export type SessionSnapshot = {
  state: SessionState;
  lastError: SessionError | null;
};
export type DebugEntry = { at: Date; message: string };

export type TunnelSession = {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  connect(input: VpnStartInput): void;
  disconnect(): void;
  onDebug(listener: (entry: DebugEntry) => void): () => void;
};

export const DEFAULT_PROBE_DELAYS = [300, 900, 1800];

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

export function createTunnelSession(
  port: TunnelNativePort,
  { probeDelays = DEFAULT_PROBE_DELAYS }: { probeDelays?: number[] } = {},
): TunnelSession {
  let snapshot: SessionSnapshot = { state: 'disconnected', lastError: null };
  const listeners = new Set<() => void>();
  const debugListeners = new Set<(entry: DebugEntry) => void>();
  // Bumped whenever a native event lands; a stale reconciliation stops.
  let generation = 0;

  const debug = (message: string) => {
    const entry = { at: new Date(), message };
    debugListeners.forEach(l => l(entry));
  };
  const set = (patch: Partial<SessionSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    debug(
      `State: ${snapshot.state}${
        snapshot.lastError ? ` (${snapshot.lastError.code})` : ''
      }.`,
    );
    listeners.forEach(l => l());
  };

  // `gen` is captured when the command is issued: a native event that lands
  // while the native promise is still pending also ends Reconciliation.
  const reconcile = async (after: string, gen: number) => {
    for (const ms of probeDelays) {
      await delay(ms);
      if (gen !== generation) {
        return;
      }
      const native = await port.getCurrentState();
      if (gen !== generation) {
        return;
      }
      debug(`Probe (${after}): ${native}.`);
      if (native !== snapshot.state) {
        set({ state: native });
      }
      if (native === 'connected' || native === 'disconnected') {
        return;
      }
    }
  };

  port.getCurrentState().then(
    state => set({ state }),
    e => debug(`Failed to read current state: ${errorMessage(e)}`),
  );
  port.onState(state => {
    generation++;
    debug(`Native event: ${state}.`);
    set({ state });
  });

  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onDebug: listener => {
      debugListeners.add(listener);
      return () => debugListeners.delete(listener);
    },
    connect: input => {
      if (snapshot.state !== 'disconnected') {
        debug(`Ignored connect while ${snapshot.state}.`);
        return;
      }
      set({ state: 'connecting', lastError: null });
      const gen = generation;
      port.start(input).then(
        () => reconcile('connect', gen),
        e =>
          set({
            state: 'disconnected',
            lastError: { code: 'start-failed', message: errorMessage(e) },
          }),
      );
    },
    disconnect: () => {
      if (
        snapshot.state === 'disconnected' ||
        snapshot.state === 'disconnecting'
      ) {
        debug(`Ignored disconnect while ${snapshot.state}.`);
        return;
      }
      set({ state: 'disconnecting', lastError: null });
      const gen = generation;
      port.stop().then(
        () => reconcile('disconnect', gen),
        e =>
          set({
            lastError: { code: 'stop-failed', message: errorMessage(e) },
          }),
      );
    },
  };
}
