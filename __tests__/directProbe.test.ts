import { probeDirect } from '../src/services/directProbe';

const okFetch = jest.fn(async () => ({ status: 200 } as Response));
const failFetch = jest.fn(async () => {
  throw new TypeError('Network request failed');
});
const hangFetch = jest.fn(
  (_url: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }),
);

describe('probeDirect (#99)', () => {
  test('any response means direct works, via HEAD https://<domain>', async () => {
    await expect(
      probeDirect('www.facebook.com', { fetchImpl: okFetch }),
    ).resolves.toBe('works');
    expect(okFetch).toHaveBeenCalledWith(
      'https://www.facebook.com/',
      expect.objectContaining({ method: 'HEAD' }),
    );
  });

  test('a 4xx/5xx still counts as works: the path is open', async () => {
    const fetch403 = jest.fn(async () => ({ status: 403 } as Response));
    await expect(
      probeDirect('x.com', { fetchImpl: fetch403 }),
    ).resolves.toBe('works');
  });

  test('connection failure means direct failed', async () => {
    await expect(
      probeDirect('blocked.example', { fetchImpl: failFetch }),
    ).resolves.toBe('failed');
  });

  test('no answer within the timeout means direct failed', async () => {
    await expect(
      probeDirect('slow.example', { fetchImpl: hangFetch, timeoutMs: 10 }),
    ).resolves.toBe('failed');
  });
});
