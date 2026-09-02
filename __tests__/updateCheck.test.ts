import {
  checkForUpdate,
  compareVersions,
  parseReleaseTag,
} from '../src/services/updateCheck';

describe('parseReleaseTag', () => {
  test('reads v<major>.<minor>.<patch> and ignores build stamps', () => {
    expect(parseReleaseTag('v0.0.14')).toBe('0.0.14');
    expect(parseReleaseTag('v0.0.14+2026090201')).toBe('0.0.14');
    expect(parseReleaseTag('v0.0.15-2026090301')).toBe('0.0.15');
    expect(parseReleaseTag('v1.10.3-rc.1')).toBe('1.10.3');
  });

  test('rejects garbage', () => {
    expect(parseReleaseTag('')).toBeNull();
    expect(parseReleaseTag('0.0.14')).toBeNull();
    expect(parseReleaseTag('v0.0')).toBeNull();
    expect(parseReleaseTag('v0.0.14.1')).toBeNull();
    expect(parseReleaseTag('release-2026')).toBeNull();
  });
});

describe('compareVersions', () => {
  test('orders numerically per component', () => {
    expect(compareVersions('0.0.15', '0.0.14')).toBeGreaterThan(0);
    expect(compareVersions('0.0.14', '0.0.14')).toBe(0);
    expect(compareVersions('0.0.9', '0.0.14')).toBeLessThan(0);
    expect(compareVersions('0.1.0', '0.0.99')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '0.99.99')).toBeGreaterThan(0);
  });

  test('throws on non-semver input', () => {
    expect(() => compareVersions('abc', '0.0.1')).toThrow();
    expect(() => compareVersions('1..2', '0.0.1')).toThrow();
    expect(() => compareVersions('0.0.15-beta', '0.0.1')).toThrow();
  });
});

function fakeFetch(
  body: unknown,
  { status = 200 }: { status?: number } = {},
): typeof fetch {
  return jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('checkForUpdate', () => {
  test('finds an Available Update when the release is newer', async () => {
    const result = await checkForUpdate('0.0.14', {
      fetchImpl: fakeFetch({
        tag_name: 'v0.0.15-2026090301',
        html_url: 'https://github.com/minlaxz/TwoHops/releases/tag/v0.0.15',
      }),
    });
    expect(result).toEqual({
      ok: true,
      value: {
        version: '0.0.15',
        url: 'https://github.com/minlaxz/TwoHops/releases/tag/v0.0.15',
      },
    });
  });

  test('is up to date when the release is the same or older', async () => {
    const same = await checkForUpdate('0.0.14', {
      fetchImpl: fakeFetch({ tag_name: 'v0.0.14+1', html_url: 'u' }),
    });
    expect(same).toEqual({ ok: true, value: null });
    const older = await checkForUpdate('0.0.14', {
      fetchImpl: fakeFetch({ tag_name: 'v0.0.13', html_url: 'u' }),
    });
    expect(older).toEqual({ ok: true, value: null });
  });

  test('fails on an unparseable tag rather than reporting up to date', async () => {
    const result = await checkForUpdate('0.0.14', {
      fetchImpl: fakeFetch({ tag_name: 'nightly', html_url: 'u' }),
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('nightly'),
    });
  });

  test('fails on a bad HTTP status', async () => {
    const result = await checkForUpdate('0.0.14', {
      fetchImpl: fakeFetch({ message: 'rate limited' }, { status: 403 }),
    });
    expect(result).toEqual({ ok: false, error: 'HTTP 403' });
  });

  test('fails on a network error', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    const result = await checkForUpdate('0.0.14', { fetchImpl });
    expect(result).toEqual({ ok: false, error: 'Network request failed' });
  });

  test('aborts after the timeout and reports it as a failure', async () => {
    const fetchImpl = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    ) as unknown as typeof fetch;
    const result = await checkForUpdate('0.0.14', { fetchImpl, timeoutMs: 5 });
    expect(result).toEqual({ ok: false, error: 'timeout' });
  });
});
