import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  UpdateCheckProvider,
  useUpdateCheck,
} from '../src/context/UpdateCheckContext';

const mockAppend = jest.fn();
const mockToast = jest.fn();
jest.mock('../src/context/LogsContext', () => ({
  useLogs: () => ({ debugLogs: { append: mockAppend } }),
}));
jest.mock('../src/components/AppToast', () => ({
  useAppToast: () => mockToast,
}));

type Ctx = ReturnType<typeof useUpdateCheck>;

/** A fetch whose responses are resolved by hand, in call order. */
function controlledFetch() {
  const pending: Array<(body: unknown) => void> = [];
  const fetchImpl = jest.fn(
    () =>
      new Promise(resolve => {
        pending.push(body =>
          resolve({ ok: true, status: 200, json: async () => body }),
        );
      }),
  ) as unknown as typeof fetch;
  const resolveNext = async (body: unknown) => {
    await ReactTestRenderer.act(async () => {
      pending.shift()!(body);
    });
  };
  return { fetchImpl, resolveNext };
}

async function mount(fetchImpl: typeof fetch) {
  let ctx!: Ctx;
  function Probe() {
    ctx = useUpdateCheck();
    return null;
  }
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(
      <UpdateCheckProvider
        enabled
        installedVersion="0.0.14"
        fetchImpl={fetchImpl}
      >
        <Probe />
      </UpdateCheckProvider>,
    );
  });
  return () => ctx;
}

beforeEach(() => {
  mockAppend.mockClear();
  mockToast.mockClear();
});

test('checks once on mount and reports the Available Update', async () => {
  const { fetchImpl, resolveNext } = controlledFetch();
  const ctx = await mount(fetchImpl);
  expect(ctx().status).toBe('checking');
  expect(fetchImpl).toHaveBeenCalledTimes(1);

  await resolveNext({ tag_name: 'v0.0.15-1', html_url: 'https://r/15' });
  expect(ctx().status).toBe('available');
  expect(ctx().available).toEqual({ version: '0.0.15', url: 'https://r/15' });
  expect(mockAppend.mock.calls.map(([e]) => e.message)).toEqual([
    'Update Check: started.',
    'Update Check: found 0.0.15.',
  ]);
});

test('ignores a second check while one is in flight', async () => {
  const { fetchImpl, resolveNext } = controlledFetch();
  const ctx = await mount(fetchImpl);
  await ReactTestRenderer.act(async () => {
    ctx().check({ manual: true });
  });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  await resolveNext({ tag_name: 'v0.0.14', html_url: 'u' });
  expect(ctx().status).toBe('up-to-date');
});

test('a failed check keeps the previous answer; only manual failures toast', async () => {
  const { fetchImpl, resolveNext } = controlledFetch();
  const ctx = await mount(fetchImpl);
  await resolveNext({ tag_name: 'v0.0.15', html_url: 'u' });
  expect(ctx().status).toBe('available');

  await ReactTestRenderer.act(async () => {
    ctx().check({ manual: true });
  });
  await resolveNext({ tag_name: 'garbage' });
  expect(ctx().status).toBe('available');
  expect(mockToast).toHaveBeenCalledWith("Couldn't check for updates");
  expect(
    mockAppend.mock.calls[mockAppend.mock.calls.length - 1][0].message,
  ).toBe('Update Check: failed: unparseable release: garbage.');
});

test('a failed launch check is silent and shows as failed', async () => {
  const { fetchImpl, resolveNext } = controlledFetch();
  const ctx = await mount(fetchImpl);
  await resolveNext({});
  expect(ctx().status).toBe('failed');
  expect(ctx().available).toBeNull();
  expect(mockToast).not.toHaveBeenCalled();
});

test('disabled (iOS) never fetches', async () => {
  const { fetchImpl } = controlledFetch();
  let ctx!: Ctx;
  function Probe() {
    ctx = useUpdateCheck();
    return null;
  }
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(
      <UpdateCheckProvider enabled={false} fetchImpl={fetchImpl}>
        <Probe />
      </UpdateCheckProvider>,
    );
  });
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(ctx.enabled).toBe(false);
});
