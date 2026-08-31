import type { VpnManagerState, VpnStartInput } from '../types';

/** What the native port reports: a known state, or an ordinal the app does not know. */
export type NativeStateReport = VpnManagerState | `unknown:${number}`;

/** The four native operations the Tunnel Session depends on. */
export type TunnelNativePort = {
  start(input: VpnStartInput): Promise<void>;
  stop(): Promise<void>;
  getCurrentState(): Promise<NativeStateReport>;
  onState(listener: (state: NativeStateReport) => void): () => void;
};

const KNOWN_STATES: ReadonlySet<NativeStateReport> = new Set<VpnManagerState>([
  'disconnected',
  'connecting',
  'connected',
  'waitingForRecovery',
  'recovering',
  'waitingForNetwork',
]);
const isKnownState = (r: NativeStateReport): r is VpnManagerState =>
  KNOWN_STATES.has(r);

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

/** Display State: the UI-facing collapse of Session State (see CONTEXT.md). */
export type DisplayState = 'stopped' | 'busy' | 'running';

export function displayState(state: SessionState): DisplayState {
  if (state === 'disconnected') {
    return 'stopped';
  }
  if (state === 'connecting' || state === 'disconnecting') {
    return 'busy';
  }
  return 'running'; // connected + the recovery states
}

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
  // Bumped on every command and native event; stale async results are dropped.
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
  // An unknown native state collapses to `disconnected` and is logged.
  const normalize = (report: NativeStateReport): VpnManagerState => {
    if (isKnownState(report)) {
      return report;
    }
    debug(`Unknown native state: ${report}. Treating as disconnected.`);
    return 'disconnected';
  };

  // `gen` is captured when the command is issued: a native event that lands
  // while the native promise is still pending also ends Reconciliation.
  const reconcile = async (after: 'connect' | 'disconnect', gen: number) => {
    for (const ms of probeDelays) {
      await delay(ms);
      if (gen !== generation) {
        return;
      }
      const native = normalize(await port.getCurrentState());
      if (gen !== generation) {
        return;
      }
      debug(`Probe (${after}): ${native}.`);
      if (after === 'disconnect') {
        // Only `disconnected` settles a disconnect; anything else (even
        // `connected`) is the tunnel still winding down.
        if (native === 'disconnected') {
          set({ state: native, lastError: null });
          return;
        }
        continue;
      }
      if (native === 'connected' || native === 'disconnected') {
        set({
          state: native,
          lastError:
            native === 'disconnected'
              ? {
                  code: 'start-not-confirmed',
                  message: 'The tunnel never confirmed the start.',
                }
              : null,
        });
        return;
      }
      if (native !== snapshot.state) {
        set({ state: native });
      }
    }
  };

  const seedGen = generation;
  port.getCurrentState().then(
    // A command or native event issued before the seed resolves wins.
    state => seedGen === generation && set({ state: normalize(state) }),
    e => debug(`Failed to read current state: ${errorMessage(e)}`),
  );
  port.onState(report => {
    generation++;
    debug(`Native event: ${report}.`);
    set({ state: normalize(report) });
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
      generation++;
      const gen = generation;
      port.start(input).then(
        () => reconcile('connect', gen),
        e =>
          gen === generation &&
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
      generation++;
      const gen = generation;
      port.stop().then(
        () => reconcile('disconnect', gen),
        async e => {
          // Native is truth: a failed stop leaves the tunnel wherever it was,
          // so re-read instead of sitting on `disconnecting` forever.
          const native = normalize(await port.getCurrentState());
          if (gen === generation) {
            set({
              state: native,
              lastError: { code: 'stop-failed', message: errorMessage(e) },
            });
          }
        },
      );
    },
  };
}
