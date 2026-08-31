import type { QueryLogRow } from '../types';

/** A capped, newest-first, in-memory log store with change notification. */
export type LogBuffer<T> = {
  append(row: T): void;
  clear(): void;
  getRows(): readonly T[];
  subscribe(listener: () => void): () => void;
};

export function createLogBuffer<T>({ cap }: { cap: number }): LogBuffer<T> {
  let rows: readonly T[] = [];
  const listeners = new Set<() => void>();
  return {
    append: row => {
      rows = [row, ...rows].slice(0, cap);
      listeners.forEach(l => l());
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
