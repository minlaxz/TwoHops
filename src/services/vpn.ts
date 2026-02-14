import { NativeEventEmitter } from 'react-native';
import NativeTrustTunnel from '../../specs/NativeTrustTunnel';
import { encodeConfig } from './configEncoder';
import { parseQueryLogRow } from './queryLog';
import type { VpnManagerState, VpnStartInput, QueryLogRow } from '../types';

const STATE_EVENT = 'vpn_state';
const QUERY_LOG_EVENT = 'vpn_query_log';

// const eventEmitter = new NativeEventEmitter(NativeTrustTunnel as never);
// `new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.
const eventEmitter = new NativeEventEmitter();

export const VpnClient = {
  async start(input: VpnStartInput): Promise<void> {
    const config = encodeConfig({
      server: input.server,
      routing: input.routing,
      excludedRoutes: input.excludedRoutes ?? [],
    });
    await NativeTrustTunnel.start(input.server.name, config);
  },

  async updateConfiguration(input?: VpnStartInput | null): Promise<void> {
    if (!input) {
      await NativeTrustTunnel.updateConfiguration(null, null);
      return;
    }

    const config = encodeConfig({
      server: input.server,
      routing: input.routing,
      excludedRoutes: input.excludedRoutes ?? [],
    });
    await NativeTrustTunnel.updateConfiguration(input.server.name, config);
  },

  async stop(): Promise<void> {
    await NativeTrustTunnel.stop();
  },

  async getCurrentState(): Promise<VpnManagerState> {
    const raw = await NativeTrustTunnel.getCurrentState();
    return mapStateOrdinal(raw);
  },

  onState(listener: (state: VpnManagerState) => void): () => void {
    const subscription = eventEmitter.addListener(STATE_EVENT, raw => {
      listener(mapStateOrdinal(raw));
    });

    return () => subscription.remove();
  },

  onQueryLog(listener: (row: QueryLogRow) => void): () => void {
    const subscription = eventEmitter.addListener(QUERY_LOG_EVENT, raw => {
      try {
        const parsed = parseQueryLogRow(String(raw));
        listener(parsed);
      } catch (err) {
        console.warn('Failed to parse query log entry', err);
      }
    });

    return () => subscription.remove();
  },
};

function mapStateOrdinal(raw: number): VpnManagerState {
  switch (raw) {
    case 1:
      return 'connecting';
    case 2:
      return 'connected';
    case 3:
      return 'waitingForRecovery';
    case 4:
      return 'recovering';
    case 5:
      return 'waitingForNetwork';
    case 0:
    default:
      return 'disconnected';
  }
}
