import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  SetupProfileProvider,
  useSetupProfile,
} from '../src/context/SetupProfileContext';
import { type ProfileStorage } from '../src/services/setupProfile';
import {
  PROFILES_STORAGE_KEY,
  type ProfileList,
} from '../src/services/profileStore';

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

const storedList = (map: Map<string, string>): ProfileList =>
  JSON.parse(map.get(PROFILES_STORAGE_KEY)!);

test('hydrates from storage and persists edits', async () => {
  const { storage, map } = memoryStorage();
  const ctx = await mount(storage);
  expect(ctx().isHydrated).toBe(true);
  expect(ctx().profile.dnsServers).toEqual(['1.1.1.1']);

  await ReactTestRenderer.act(async () => {
    ctx().updateEntryProfile(ctx().selectedId!, { dnsServers: ['9.9.9.9'] });
  });
  await flush();
  expect(storedList(map).profiles[0].dnsServers).toEqual(['9.9.9.9']);

  // relaunch
  const again = await mount(storage);
  expect(again().profile.dnsServers).toEqual(['9.9.9.9']);
});

test('does not write before hydration completes', async () => {
  const { storage, map } = memoryStorage();
  await mount(storage);
  await flush();
  expect(map.has(PROFILES_STORAGE_KEY)).toBe(false);
});

test('edits land on the addressed profile only, selected or not', async () => {
  const seed: ProfileList = {
    version: 1,
    profiles: [defaultsEntry('a', 'Alpha'), defaultsEntry('b', 'Beta')],
    selectedId: 'a',
  };
  const { storage, map } = memoryStorage({
    [PROFILES_STORAGE_KEY]: JSON.stringify(seed),
  });
  const ctx = await mount(storage);
  await ReactTestRenderer.act(async () => {
    ctx().updateEntryServer('b', { login: 'bob' });
  });
  await flush();
  expect(ctx().profile.server.login).toBe(''); // Selected Profile untouched
  expect(storedList(map).profiles[1].server.login).toBe('bob');
});

test('addProfile returns the new id; rename and delete persist', async () => {
  const { storage, map } = memoryStorage();
  const ctx = await mount(storage);
  let id = '';
  await ReactTestRenderer.act(async () => {
    id = ctx().addProfile();
  });
  await flush();
  expect(ctx().profiles).toHaveLength(2);
  expect(storedList(map).profiles[1].id).toBe(id);

  await ReactTestRenderer.act(async () => {
    ctx().renameProfile(id, 'Backup');
  });
  await flush();
  expect(storedList(map).profiles[1].name).toBe('Backup');

  await ReactTestRenderer.act(async () => {
    ctx().deleteProfile(id);
  });
  await flush();
  expect(storedList(map).profiles).toHaveLength(1);
});

test('addFromProfileLink creates + selects; errors reported', async () => {
  const { storage, map } = memoryStorage();
  const ctx = await mount(storage);
  let result!: ReturnType<Ctx['addFromProfileLink']>;
  await ReactTestRenderer.act(async () => {
    result = ctx().addFromProfileLink('twohops://x?login=bob', true);
  });
  await flush();
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(ctx().selectedId).toBe(result.value.id);
  expect(storedList(map).profiles).toHaveLength(2);
  expect(ctx().profile.server.login).toBe('bob');

  await ReactTestRenderer.act(async () => {
    result = ctx().addFromProfileLink('https://x', true);
  });
  expect(result).toEqual({ ok: false, error: { kind: 'scheme' } });
  expect(ctx().profiles).toHaveLength(2);
});

test('selectProfile switches the Selected Profile and persists', async () => {
  const seed: ProfileList = {
    version: 1,
    profiles: [
      { ...defaultsEntry('a', 'Alpha'), localRulesText: 'a.com' },
      { ...defaultsEntry('b', 'Beta'), localRulesText: 'b.com' },
    ],
    selectedId: 'a',
  };
  const { storage, map } = memoryStorage({
    [PROFILES_STORAGE_KEY]: JSON.stringify(seed),
  });
  const ctx = await mount(storage);
  expect(ctx().profiles.map(entry => entry.name)).toEqual(['Alpha', 'Beta']);
  expect(ctx().profile.localRulesText).toBe('a.com');

  await ReactTestRenderer.act(async () => {
    ctx().selectProfile('b');
  });
  await flush();
  expect(ctx().selectedId).toBe('b');
  expect(ctx().profile.localRulesText).toBe('b.com');
  expect(storedList(map).selectedId).toBe('b');
});

function defaultsEntry(id: string, name: string) {
  return {
    version: 1 as const,
    server: {
      name,
      ipAddress: '',
      domain: '',
      login: '',
      password: '',
      vpnProtocol: 'QUIC' as const,
    },
    dnsServers: [],
    routingMode: 'selective' as const,
    localRulesText: '',
    remoteRulesURL: '',
    importedRules: [],
    importedAt: null,
    id,
    name,
  };
}
