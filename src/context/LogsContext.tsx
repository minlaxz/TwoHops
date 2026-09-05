import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { VpnClient } from '../services/vpn';
import {
  createCoreLogBuffer,
  createLogBuffer,
  createTrafficLogBuffer,
  type CoreLogBuffer,
  type LogBuffer,
} from '../services/logBuffer';
import type { DebugEntry } from '../services/tunnelSession';
import type { QueryLogRow } from '../types';
import { useTunnelSession } from './TunnelSessionContext';
import { useLogSettings } from './LogSettingsContext';

const DEBUG_LOG_CAP = 200;

type LogsContextValue = {
  trafficLogs: LogBuffer<QueryLogRow>;
  debugLogs: LogBuffer<DebugEntry>;
  coreLogs: CoreLogBuffer;
};

const LogsContext = createContext<LogsContextValue | undefined>(undefined);

// Real buffers, created once at the provider's first render — before any
// tunnel can start — so Traffic rows collect while no screen is open.
// App-lifetime by design: no disposal path.
let realTraffic: LogBuffer<QueryLogRow> | undefined;
let realDebug: LogBuffer<DebugEntry> | undefined;
let realCore: CoreLogBuffer | undefined;
const defaultTraffic = () =>
  (realTraffic ??= createTrafficLogBuffer(VpnClient));
const defaultDebug = () =>
  (realDebug ??= createLogBuffer<DebugEntry>({ cap: DEBUG_LOG_CAP }));
const defaultCore = () => (realCore ??= createCoreLogBuffer(VpnClient));

type Props = {
  children: React.ReactNode;
  /** Injected for tests; default to the shared app-wide buffers. */
  trafficLogs?: LogBuffer<QueryLogRow>;
  debugLogs?: LogBuffer<DebugEntry>;
  coreLogs?: CoreLogBuffer;
};

export function LogsProvider({
  children,
  trafficLogs = defaultTraffic(),
  debugLogs = defaultDebug(),
  coreLogs = defaultCore(),
}: Props) {
  const { session } = useTunnelSession();
  const {
    debugLoggingEnabled,
    trafficLoggingEnabled,
    coreLoggingEnabled,
    coreLogLevel,
  } = useLogSettings();
  useEffect(
    () => session.onDebug(entry => debugLogs.append(entry)),
    [session, debugLogs],
  );
  // Capture gates (issue #69): OFF stops collecting; buffered rows stay.
  useEffect(() => {
    debugLogs.setCaptureEnabled(debugLoggingEnabled);
  }, [debugLogs, debugLoggingEnabled]);
  useEffect(() => {
    trafficLogs.setCaptureEnabled(trafficLoggingEnabled);
  }, [trafficLogs, trafficLoggingEnabled]);
  // Core Logging (issue #136): level first so the ON call carries it.
  useEffect(() => {
    coreLogs.setLevel(coreLogLevel);
  }, [coreLogs, coreLogLevel]);
  useEffect(() => {
    coreLogs.setCaptureEnabled(coreLoggingEnabled);
  }, [coreLogs, coreLoggingEnabled]);
  const value = useMemo(
    () => ({ trafficLogs, debugLogs, coreLogs }),
    [trafficLogs, debugLogs, coreLogs],
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
