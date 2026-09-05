import { parseCoreLogRow } from '../src/services/coreLog';

const payload = (message: string, level = 'debug') =>
  JSON.stringify({ level, message, date: '2026-09-05T10:00:00.000Z' });

test('maps logger names to tags and strips the name from the message', () => {
  const cases: [string, string, string][] = [
    [
      'DNS_HANDLER [tun0] qname: example.com -> DNS proxy',
      'dns',
      '[tun0] qname: example.com -> DNS proxy',
    ],
    ['DNS_CLIENT resolved', 'dns', 'resolved'],
    ['VPNCORE started', 'core', 'started'],
    ['VPNCLIENT connecting', 'client', 'connecting'],
    ['JNI.NativeLogger hello', 'jni', 'hello'],
    ['TrustTunnel_Native onStateChanged(2)', 'jni', 'onStateChanged(2)'],
  ];
  for (const [line, tag, message] of cases) {
    expect(parseCoreLogRow(payload(line))).toMatchObject({ tag, message });
  }
});

test('unknown logger name tags other and keeps the whole line', () => {
  const row = parseCoreLogRow(payload('SOMETHING new thing', 'warn'));
  expect(row).toMatchObject({
    level: 'warn',
    tag: 'other',
    message: 'SOMETHING new thing',
  });
  expect(row.stamp.toISOString()).toBe('2026-09-05T10:00:00.000Z');
});

test('rejects malformed payloads', () => {
  expect(() => parseCoreLogRow('not json')).toThrow('not valid JSON');
  expect(() => parseCoreLogRow('42')).toThrow('must be an object');
  expect(() => parseCoreLogRow(payload('x', 'critical'))).toThrow(
    'Invalid core log level',
  );
  expect(() =>
    parseCoreLogRow(JSON.stringify({ level: 'info', message: 1, date: 'x' })),
  ).toThrow('message');
  expect(() =>
    parseCoreLogRow(JSON.stringify({ level: 'info', message: 'm', date: 'x' })),
  ).toThrow('timestamp');
});
