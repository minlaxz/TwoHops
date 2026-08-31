import {
  defaultProfileList,
  loadProfileList,
  saveProfileList,
  selectProfile,
  selectedProfile,
  updateSelected,
  PROFILES_STORAGE_KEY,
  type ProfileList,
} from '../src/services/profileStore';
import {
  clearProfile,
  defaultProfile,
  updateProfile,
  updateServer,
  PROFILE_STORAGE_KEY,
  LEGACY_STORAGE_KEYS,
  type ProfileEnv,
  type ProfileStorage,
  type SetupProfile,
} from '../src/services/setupProfile';

const env: ProfileEnv = {
  ENV_SERVER_NAME: 'env-server',
  ENV_PROTOCOL: 'Http/2',
  ENV_DNS_SERVERS: '1.1.1.1,8.8.8.8',
};

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

function completeProfile(): SetupProfile {
  return updateServer(defaultProfile(env), {
    ipAddress: '10.0.0.1',
    domain: 'vpn.example.com',
    login: 'user',
    password: 'pw',
  });
}

function twoProfileList(): ProfileList {
  return {
    version: 1,
    profiles: [
      { ...completeProfile(), id: 'a', name: 'Alpha' },
      { ...defaultProfile(env), id: 'b', name: 'Beta' },
    ],
    selectedId: 'a',
  };
}

describe('defaultProfileList', () => {
  test('seeds one default entry, named from env server name, selected', () => {
    const list = defaultProfileList(env);
    expect(list.version).toBe(1);
    expect(list.profiles).toHaveLength(1);
    const entry = list.profiles[0];
    expect(entry.name).toBe('env-server');
    expect(entry.id).toBeTruthy();
    expect(list.selectedId).toBe(entry.id);
    expect(entry).toEqual({
      ...defaultProfile(env),
      id: entry.id,
      name: 'env-server',
    });
  });

  test('empty env falls back to "Profile 1"', () => {
    expect(defaultProfileList({}).profiles[0].name).toBe('Profile 1');
  });
});

describe('selectProfile / selectedProfile', () => {
  test('selects an existing profile', () => {
    const list = selectProfile(twoProfileList(), 'b');
    expect(list.selectedId).toBe('b');
    expect(selectedProfile(list)?.name).toBe('Beta');
  });

  test('unknown id is a no-op', () => {
    const list = twoProfileList();
    expect(selectProfile(list, 'nope')).toBe(list);
  });

  test('selectedProfile is null when the pointer matches nothing', () => {
    expect(
      selectedProfile({ version: 1, profiles: [], selectedId: null }),
    ).toBeNull();
  });
});

describe('updateSelected', () => {
  test('transforms only the selected entry; keeps id and name', () => {
    const list = updateSelected(twoProfileList(), profile =>
      updateProfile(profile, { routingMode: 'general' }),
    );
    expect(selectedProfile(list)).toMatchObject({
      id: 'a',
      name: 'Alpha',
      routingMode: 'general',
    });
    expect(list.profiles[1]).toEqual(twoProfileList().profiles[1]);
  });

  test('a transform that rebuilds the profile keeps id and name', () => {
    const list = updateSelected(twoProfileList(), () => clearProfile(env));
    expect(selectedProfile(list)).toEqual({
      ...defaultProfile(env),
      id: 'a',
      name: 'Alpha',
    });
  });

  test('no selection is a no-op', () => {
    const list: ProfileList = { version: 1, profiles: [], selectedId: null };
    expect(updateSelected(list, () => completeProfile())).toBe(list);
  });
});

describe('saveProfileList / loadProfileList', () => {
  test('round-trips one JSON document under one key', async () => {
    const { storage, map } = memoryStorage();
    const list = twoProfileList();
    await saveProfileList(storage, list);
    expect([...map.keys()]).toEqual([PROFILES_STORAGE_KEY]);
    await expect(loadProfileList(storage, env)).resolves.toEqual(list);
  });

  test('fresh install yields the seeded default list, writes nothing', async () => {
    const { storage, map } = memoryStorage();
    const list = await loadProfileList(storage, env);
    expect(list.profiles).toHaveLength(1);
    expect(list.profiles[0].name).toBe('env-server');
    expect(map.size).toBe(0);
  });

  test('corrupt list document warns and yields defaults', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { storage } = memoryStorage({ [PROFILES_STORAGE_KEY]: '{not json' });
    const list = await loadProfileList(storage, env);
    expect(list.profiles).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('unknown list version warns and yields defaults', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { storage } = memoryStorage({
      [PROFILES_STORAGE_KEY]: JSON.stringify({ version: 99 }),
    });
    const list = await loadProfileList(storage, env);
    expect(list.profiles).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('one-shot migration', () => {
  test('wraps the ADR 0001 single document, selects it, deletes the old key', async () => {
    const single = completeProfile();
    const { storage, map } = memoryStorage({
      [PROFILE_STORAGE_KEY]: JSON.stringify(single),
    });
    const list = await loadProfileList(storage, env);
    expect(list.profiles).toHaveLength(1);
    const entry = list.profiles[0];
    expect(entry.name).toBe('env-server'); // named from its server name
    expect(list.selectedId).toBe(entry.id);
    expect(entry).toEqual({ ...single, id: entry.id, name: entry.name });
    expect(map.has(PROFILE_STORAGE_KEY)).toBe(false);
    expect(JSON.parse(map.get(PROFILES_STORAGE_KEY)!)).toEqual(list);
  });

  test('blank server name falls back to "Profile 1"', async () => {
    const single = updateServer(completeProfile(), { name: '  ' });
    const { storage } = memoryStorage({
      [PROFILE_STORAGE_KEY]: JSON.stringify(single),
    });
    const list = await loadProfileList(storage, env);
    expect(list.profiles[0].name).toBe('Profile 1');
  });

  test('chains from the pre-ADR-0001 multi-key layout', async () => {
    const { storage, map } = memoryStorage({
      [LEGACY_STORAGE_KEYS.serverIpAddress]: '10.0.0.1',
      [LEGACY_STORAGE_KEYS.serverLogin]: 'user',
    });
    const list = await loadProfileList(storage, env);
    expect(list.profiles).toHaveLength(1);
    expect(list.profiles[0].server.ipAddress).toBe('10.0.0.1');
    expect(list.profiles[0].server.login).toBe('user');
    expect(list.selectedId).toBe(list.profiles[0].id);
    expect([...map.keys()]).toEqual([PROFILES_STORAGE_KEY]);
  });

  test('migration runs once: second load reads the list document', async () => {
    const { storage, map } = memoryStorage({
      [PROFILE_STORAGE_KEY]: JSON.stringify(completeProfile()),
    });
    const first = await loadProfileList(storage, env);
    const second = await loadProfileList(storage, env);
    expect(second).toEqual(first);
    expect([...map.keys()]).toEqual([PROFILES_STORAGE_KEY]);
  });
});
