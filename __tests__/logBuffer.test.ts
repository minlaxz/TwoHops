import {
  createLogBuffer,
  createTrafficLogBuffer,
  TRAFFIC_LOG_CAP,
  createCoreLogBuffer,
  CORE_LOG_CAP,
} from '../src/services/logBuffer';
import type { QueryLogRow } from '../src/types';
import type { CoreLogRow } from '../src/services/coreLog';

function row(domain: string): QueryLogRow {
  return {
    action: 'tunnel',
    protocol: 'tcp',
    source: '10.0.0.2:1234',
    destination: '1.2.3.4:443',
    domain,
    stamp: new Date('2026-01-01T00:00:00Z'),
  };
}

// Fake native client: same shape the tunnel-session tests use for their port.
function fakeQueryLogPort() {
  let listener: ((r: QueryLogRow) => void) | null = null;
  return {
    port: {
      onQueryLog: (l: (r: QueryLogRow) => void) => {
        listener = l;
        return () => {
          listener = null;
        };
      },
    },
    emit: (r: QueryLogRow) => listener?.(r),
  };
}

test('appends newest first', () => {
  const buffer = createLogBuffer<string>({ cap: 10 });
  buffer.append('a');
  buffer.append('b');
  expect(buffer.getRows()).toEqual(['b', 'a']);
});

test('cap holds: oldest rows fall off', () => {
  const buffer = createLogBuffer<number>({ cap: 3 });
  [1, 2, 3, 4, 5].forEach(n => buffer.append(n));
  expect(buffer.getRows()).toEqual([5, 4, 3]);
});

test('notifies subscribers on append; unsubscribe stops', () => {
  const buffer = createLogBuffer<string>({ cap: 10 });
  const listener = jest.fn();
  const unsubscribe = buffer.subscribe(listener);
  buffer.append('a');
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  buffer.append('b');
  expect(listener).toHaveBeenCalledTimes(1);
});

test('clear empties the buffer and notifies subscribers', () => {
  const buffer = createLogBuffer<string>({ cap: 10 });
  buffer.append('a');
  const listener = jest.fn();
  buffer.subscribe(listener);
  buffer.clear();
  expect(buffer.getRows()).toEqual([]);
  expect(listener).toHaveBeenCalledTimes(1);
});

test('clear on an empty buffer keeps the snapshot stable and stays silent', () => {
  const buffer = createLogBuffer<string>({ cap: 10 });
  const before = buffer.getRows();
  const listener = jest.fn();
  buffer.subscribe(listener);
  buffer.clear();
  expect(buffer.getRows()).toBe(before);
  expect(listener).not.toHaveBeenCalled();
});

test('getRows is referentially stable until the next append', () => {
  // useSyncExternalStore requires a stable snapshot between changes.
  const buffer = createLogBuffer<string>({ cap: 10 });
  buffer.append('a');
  expect(buffer.getRows()).toBe(buffer.getRows());
});

test('capture disabled: append drops the row silently', () => {
  const buffer = createLogBuffer<string>({ cap: 10 });
  buffer.append('kept');
  const listener = jest.fn();
  buffer.subscribe(listener);
  buffer.setCaptureEnabled(false);
  buffer.append('dropped');
  expect(buffer.getRows()).toEqual(['kept']);
  expect(listener).not.toHaveBeenCalled();
});

test('capture re-enabled: earlier rows kept, new rows collect again', () => {
  const buffer = createLogBuffer<string>({ cap: 10 });
  buffer.append('before');
  buffer.setCaptureEnabled(false);
  buffer.append('gap');
  buffer.setCaptureEnabled(true);
  buffer.append('after');
  expect(buffer.getRows()).toEqual(['after', 'before']);
});

test('clear still works while capture is disabled', () => {
  const buffer = createLogBuffer<string>({ cap: 10 });
  buffer.append('a');
  buffer.setCaptureEnabled(false);
  buffer.clear();
  expect(buffer.getRows()).toEqual([]);
});

test('traffic buffer collects from creation, with no subscriber attached', () => {
  const { port, emit } = fakeQueryLogPort();
  const buffer = createTrafficLogBuffer(port);
  emit(row('early.example.com'));
  emit(row('later.example.com'));
  expect(buffer.getRows().map(r => r.domain)).toEqual([
    'later.example.com',
    'early.example.com',
  ]);
});

test('traffic buffer cap holds', () => {
  const { port, emit } = fakeQueryLogPort();
  const buffer = createTrafficLogBuffer(port, { cap: 2 });
  emit(row('one.example.com'));
  emit(row('two.example.com'));
  emit(row('three.example.com'));
  expect(buffer.getRows().map(r => r.domain)).toEqual([
    'three.example.com',
    'two.example.com',
  ]);
});

test('traffic buffer default cap matches the UI cap', () => {
  const { port, emit } = fakeQueryLogPort();
  const buffer = createTrafficLogBuffer(port);
  for (let i = 0; i < TRAFFIC_LOG_CAP + 20; i++) {
    emit(row(`host-${i}.example.com`));
  }
  expect(buffer.getRows()).toHaveLength(TRAFFIC_LOG_CAP);
});

// Core Logs (#136): capture gate + level reach the native side as one call.
function fakeCoreLogPort() {
  let listener: ((r: CoreLogRow) => void) | null = null;
  const calls: [boolean, string][] = [];
  return {
    port: {
      onCoreLog: (l: (r: CoreLogRow) => void) => {
        listener = l;
        return () => {
          listener = null;
        };
      },
      setCoreLogging: async (enabled: boolean, level: string) => {
        calls.push([enabled, level]);
      },
    },
    calls,
    emit: (r: CoreLogRow) => listener?.(r),
  };
}

const coreRow = (message: string): CoreLogRow => ({
  level: 'info',
  tag: 'core',
  message,
  stamp: new Date('2026-01-01T00:00:00Z'),
});

test('core buffer caps at 500 by default and drops the oldest', () => {
  const { port, emit } = fakeCoreLogPort();
  const buffer = createCoreLogBuffer(port);
  for (let i = 0; i < CORE_LOG_CAP + 5; i++) {
    emit(coreRow(`line ${i}`));
  }
  expect(buffer.getRows()).toHaveLength(500);
  expect(buffer.getRows()[0].message).toBe(`line ${CORE_LOG_CAP + 4}`);
});

test('core buffer forwards gate and level to the port; OFF keeps rows', () => {
  const { port, calls, emit } = fakeCoreLogPort();
  const buffer = createCoreLogBuffer(port, { cap: 5 });
  buffer.setCaptureEnabled(true);
  buffer.setLevel('debug');
  expect(calls).toEqual([
    [true, 'info'],
    [true, 'debug'],
  ]);
  emit(coreRow('kept'));
  buffer.setCaptureEnabled(false);
  emit(coreRow('dropped'));
  expect(calls[2]).toEqual([false, 'debug']);
  expect(buffer.getRows().map(r => r.message)).toEqual(['kept']);
});
