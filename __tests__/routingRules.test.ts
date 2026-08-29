import {
  parseRules,
  mergeRules,
  serializeRules,
  expandRules,
  fetchRemoteRules,
  resolveRules,
} from '../src/services/routingRules';

describe('parseRules', () => {
  test('multi-line input yields one rule per line', () => {
    expect(parseRules('a.com\nb.com\nc.com')).toEqual([
      'a.com',
      'b.com',
      'c.com',
    ]);
  });

  test('mixed comma / newline / CRLF; trims; drops empties', () => {
    expect(parseRules(' a.com, b.com\r\n\nc.com ,,\n 10.0.0.0/8 \r\n')).toEqual(
      ['a.com', 'b.com', 'c.com', '10.0.0.0/8'],
    );
  });

  test('empty input yields empty list', () => {
    expect(parseRules('')).toEqual([]);
    expect(parseRules(' \n, \r\n')).toEqual([]);
  });
});

describe('mergeRules', () => {
  test('local first, deduplicated, insertion order', () => {
    expect(mergeRules(['b.com', 'a.com'], ['c.com', 'a.com', 'b.com'])).toEqual(
      ['b.com', 'a.com', 'c.com'],
    );
  });

  test('dedupes within local too', () => {
    expect(mergeRules(['a.com', 'a.com'], [])).toEqual(['a.com']);
  });
});

describe('serializeRules', () => {
  test('canonical newline-joined form', () => {
    expect(serializeRules(['a.com', 'b.com'])).toBe('a.com\nb.com');
  });

  test('round-trips through parseRules', () => {
    const rules = ['a.com', '1.2.3.4', '10.0.0.0/8'];
    expect(parseRules(serializeRules(rules))).toEqual(rules);
  });
});

describe('expandRules', () => {
  test('adds wildcard form for domains; IPs/CIDRs untouched', () => {
    expect(
      expandRules(['example.com', '1.2.3.4', '10.0.0.0/8', '[::1]:443']),
    ).toEqual([
      '1.2.3.4',
      '10.0.0.0/8',
      '[::1]:443',
      'example.com',
      '*.example.com',
    ]);
  });

  test('does not double-wildcard', () => {
    expect(expandRules(['*.example.com'])).toEqual(['*.example.com']);
  });

  test('trims and drops empties, dedupes', () => {
    expect(expandRules([' a.com ', '', 'a.com'])).toEqual(['a.com', '*.a.com']);
  });
});

describe('fetchRemoteRules', () => {
  const okResponse = (text: string) =>
    Promise.resolve({
      ok: true,
      statusText: 'OK',
      text: () => Promise.resolve(text),
    });

  test('multi-line remote file yields one rule per line', async () => {
    const fetchImpl = () => okResponse('a.com\nb.com\r\nc.com\n');
    await expect(
      fetchRemoteRules('https://x/rules.txt', fetchImpl as any),
    ).resolves.toEqual(['a.com', 'b.com', 'c.com']);
  });

  test('non-OK response throws', async () => {
    const fetchImpl = () =>
      Promise.resolve({
        ok: false,
        statusText: 'Not Found',
        text: () => Promise.resolve(''),
      });
    await expect(
      fetchRemoteRules('https://x/rules.txt', fetchImpl as any),
    ).rejects.toThrow('Not Found');
  });

  test('network error throws', async () => {
    const fetchImpl = () => Promise.reject(new Error('offline'));
    await expect(
      fetchRemoteRules('https://x/rules.txt', fetchImpl as any),
    ).rejects.toThrow('offline');
  });
});

describe('resolveRules', () => {
  test('no remote URL merges local only; fetch never called', async () => {
    const fetchImpl = jest.fn();
    await expect(
      resolveRules('a.com, b.com', '', fetchImpl as any),
    ).resolves.toEqual(['a.com', 'b.com']);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('local first then remote, deduplicated', async () => {
    const fetchImpl = () =>
      Promise.resolve({
        ok: true,
        statusText: 'OK',
        text: () => Promise.resolve('b.com\nc.com'),
      });
    await expect(
      resolveRules('a.com\nb.com', 'https://x', fetchImpl as any),
    ).resolves.toEqual(['a.com', 'b.com', 'c.com']);
  });

  test('propagates fetch failure', async () => {
    const fetchImpl = () => Promise.reject(new Error('offline'));
    await expect(
      resolveRules('a.com', 'https://x', fetchImpl as any),
    ).rejects.toThrow('offline');
  });
});
