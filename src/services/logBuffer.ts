import type { CoreLogLevel, CoreLogRow } from './coreLog';
import type { QueryLogRow } from '../types';

/** A capped, newest-first, in-memory log store with change notification. */
export type LogBuffer<T> = {
  append(row: T): void;
  clear(): void;
  getRows(): readonly T[];
  subscribe(listener: () => void): () => void;
  /** Capture gate (issue #69): disabled drops appends; existing rows stay. */
  setCaptureEnabled(enabled: boolean): void;
};

export function createLogBuffer<T>({ cap }: { cap: number }): LogBuffer<T> {
  let rows: readonly T[] = [];
  let captureEnabled = true;
  const listeners = new Set<() => void>();
  return {
    append: row => {
      if (!captureEnabled) {
        return;
      }
      rows = [row, ...rows].slice(0, cap);
      listeners.forEach(l => l());
    },
    setCaptureEnabled: enabled => {
      captureEnabled = enabled;
    },
    clear: () => {
      // No-op on empty keeps the snapshot referentially stable.
      if (rows.length === 0) {
        return;
      }
      rows = [];
      listeners.forEach(l => l());
    },
    getRows: () => rows,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The one native operation the Traffic Log buffer depends on. */
export type TrafficLogPort = {
  onQueryLog(listener: (row: QueryLogRow) => void): () => void;
};

export const TRAFFIC_LOG_CAP = 250;

/**
 * Traffic Logs collect from creation (app start), independent of which
 * screen is open. Deliberately outside the Tunnel Session (ADR 0002).
 */
export function createTrafficLogBuffer(
  port: TrafficLogPort,
  { cap = TRAFFIC_LOG_CAP }: { cap?: number } = {},
): LogBuffer<QueryLogRow> {
  const buffer = createLogBuffer<QueryLogRow>({ cap });
  port.onQueryLog(row => buffer.append(row));
  return buffer;
}

/** The native operations the Core Log buffer depends on (issue #136). */
export type CoreLogPort = {
  onCoreLog(listener: (row: CoreLogRow) => void): () => void;
  /** Gates the bridge and sets the native level; OFF restores INFO natively. */
  setCoreLogging(enabled: boolean, level: CoreLogLevel): Promise<void>;
};

export const CORE_LOG_CAP = 500;

export type CoreLogBuffer = LogBuffer<CoreLogRow> & {
  /** Core Log Level: what the core emits and therefore what the tab shows. */
  setLevel(level: CoreLogLevel): void;
};

/**
 * Core Logs mirror Traffic Logs (app-lifetime, outside the Tunnel Session),
 * but capture is gated natively too so the bridge is not flooded when OFF.
 */
export function createCoreLogBuffer(
  port: CoreLogPort,
  { cap = CORE_LOG_CAP }: { cap?: number } = {},
): CoreLogBuffer {
  const buffer = createLogBuffer<CoreLogRow>({ cap });
  let enabled = false;
  let level: CoreLogLevel = 'info';
  const sync = () => {
    port.setCoreLogging(enabled, level).catch(err => {
      console.warn('Failed to set core logging', err);
    });
  };
  port.onCoreLog(row => buffer.append(row));
  return {
    ...buffer,
    setCaptureEnabled: next => {
      buffer.setCaptureEnabled(next);
      enabled = next;
      sync();
    },
    setLevel: next => {
      level = next;
      sync();
    },
  };
}
