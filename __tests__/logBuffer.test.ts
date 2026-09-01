import {
  createLogBuffer,
  createTrafficLogBuffer,
  TRAFFIC_LOG_CAP,
} from '../src/services/logBuffer';
import type { QueryLogRow } from '../src/types';

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
