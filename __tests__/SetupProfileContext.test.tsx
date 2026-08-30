import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  SetupProfileProvider,
  useSetupProfile,
} from '../src/context/SetupProfileContext';
import {
  PROFILE_STORAGE_KEY,
  type ProfileStorage,
} from '../src/services/setupProfile';

jest.mock('react-native-config', () => ({
  ENV_SERVER_NAME: 'env-server',
  ENV_PROTOCOL: 'QUIC',
  ENV_DNS_SERVERS: '1.1.1.1',
}));

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  const storage: ProfileStorage = {
    getItem: key => Promise.resolve(map.get(key) ?? null),
    setItem: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    multiRemove: keys => {
      keys.forEach(key => map.delete(key));
      return Promise.resolve();
    },
  };
  return { storage, map };
}

type Ctx = ReturnType<typeof useSetupProfile>;

async function mount(storage: ProfileStorage) {
  const ref: { current: Ctx | null } = { current: null };
  function Probe() {
    ref.current = useSetupProfile();
    return null;
  }
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(
      <SetupProfileProvider storage={storage}>
        <Probe />
      </SetupProfileProvider>,
    );
  });
  return () => ref.current as Ctx;
}

const flush = () => ReactTestRenderer.act(() => Promise.resolve());

test('hydrates from storage and persists edits', async () => {
  const { storage, map } = memoryStorage();
  const ctx = await mount(storage);
  expect(ctx().isHydrated).toBe(true);
  expect(ctx().profile.dnsServers).toEqual(['1.1.1.1']);

  await ReactTestRenderer.act(async () => {
    ctx().updateProfile({ dnsServers: ['9.9.9.9'] });
  });
  await flush();
  expect(JSON.parse(map.get(PROFILE_STORAGE_KEY)!).dnsServers).toEqual([
    '9.9.9.9',
  ]);

  // relaunch
  const again = await mount(storage);
  expect(again().profile.dnsServers).toEqual(['9.9.9.9']);
});

test('does not write before hydration completes', async () => {
  const { storage, map } = memoryStorage();
  await mount(storage);
  await flush();
  expect(map.has(PROFILE_STORAGE_KEY)).toBe(false);
});

test('clear resets to defaults', async () => {
  const { storage, map } = memoryStorage();
  const ctx = await mount(storage);
  await ReactTestRenderer.act(async () => {
    ctx().updateServer({ login: 'bob' });
  });
  await ReactTestRenderer.act(async () => {
    ctx().clearProfile();
  });
  await flush();
  expect(ctx().profile.server.login).toBe('');
  expect(JSON.parse(map.get(PROFILE_STORAGE_KEY)!).server.login).toBe('');
});
