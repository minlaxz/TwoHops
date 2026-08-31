import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { VpnClient } from '../services/vpn';
import {
  createLogBuffer,
  createTrafficLogBuffer,
  type LogBuffer,
} from '../services/logBuffer';
import type { DebugEntry } from '../services/tunnelSession';
import type { QueryLogRow } from '../types';
import { useTunnelSession } from './TunnelSessionContext';

const DEBUG_LOG_CAP = 200;

type LogsContextValue = {
  trafficLogs: LogBuffer<QueryLogRow>;
  debugLogs: LogBuffer<DebugEntry>;
};

const LogsContext = createContext<LogsContextValue | undefined>(undefined);

// Real buffers, created once at the provider's first render — before any
// tunnel can start — so Traffic rows collect while no screen is open.
// App-lifetime by design: no disposal path.
let realTraffic: LogBuffer<QueryLogRow> | undefined;
let realDebug: LogBuffer<DebugEntry> | undefined;
const defaultTraffic = () =>
  (realTraffic ??= createTrafficLogBuffer(VpnClient));
const defaultDebug = () =>
  (realDebug ??= createLogBuffer<DebugEntry>({ cap: DEBUG_LOG_CAP }));

type Props = {
  children: React.ReactNode;
  /** Injected for tests; default to the shared app-wide buffers. */
  trafficLogs?: LogBuffer<QueryLogRow>;
  debugLogs?: LogBuffer<DebugEntry>;
};

export function LogsProvider({
  children,
  trafficLogs = defaultTraffic(),
  debugLogs = defaultDebug(),
}: Props) {
  const { session } = useTunnelSession();
  useEffect(
    () => session.onDebug(entry => debugLogs.append(entry)),
    [session, debugLogs],
  );
  const value = useMemo(
    () => ({ trafficLogs, debugLogs }),
    [trafficLogs, debugLogs],
  );
  return <LogsContext.Provider value={value}>{children}</LogsContext.Provider>;
}

export function useLogs(): LogsContextValue {
  const value = useContext(LogsContext);
  if (!value) {
    throw new Error('useLogs must be used inside LogsProvider.');
  }
  return value;
}
