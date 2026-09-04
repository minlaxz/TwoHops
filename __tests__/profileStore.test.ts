import {
  addFromProfileLink,
  createProfile,
  defaultProfileList,
  deleteProfile,
  loadProfileList,
  renameProfile,
  saveProfileList,
  selectProfile,
  selectedProfile,
  updateEntry,
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

describe('createProfile', () => {
  test('appends the committed draft named after its server; selection unchanged', () => {
    const draft = completeProfile();
    const { list, id } = createProfile(twoProfileList(), draft);
    expect(list.profiles).toHaveLength(3);
    const entry = list.profiles[2];
    expect(entry.id).toBe(id);
    expect(entry).toEqual({ ...draft, id, name: 'env-server' });
    expect(list.selectedId).toBe('a');
  });

  test('an empty list selects the new profile', () => {
    const { list, id } = createProfile(
      { version: 1, profiles: [], selectedId: null },
      completeProfile(),
    );
    expect(list.selectedId).toBe(id);
  });
});

describe('addFromProfileLink', () => {
  const link =
    'twohops://x?login=bob&password=pw&ip=10.9.9.9&domain=d.example.com';

  test('creates a new entry from the link; existing profiles untouched', () => {
    const before = twoProfileList();
    const result = addFromProfileLink(before, link, env, false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { list, id } = result.value;
    expect(list.profiles.slice(0, 2)).toEqual(before.profiles);
    const entry = list.profiles[2];
    expect(entry.id).toBe(id);
    expect(entry.server).toMatchObject({
      login: 'bob',
      password: 'pw',
      ipAddress: '10.9.9.9',
      domain: 'd.example.com',
    });
    expect(list.selectedId).toBe('a'); // not Stopped → selection unchanged
  });

  test('selects the new entry when asked (Stopped)', () => {
    const result = addFromProfileLink(twoProfileList(), link, env, true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.list.selectedId).toBe(result.value.id);
  });

  test('names the entry from the env server name, else the link domain', () => {
    const withEnvName = addFromProfileLink(twoProfileList(), link, env, false);
    if (!withEnvName.ok) throw new Error('expected ok');
    expect(withEnvName.value.list.profiles[2].name).toBe('env-server');

    // No env name: applyProfileLink defaulted the server name from the domain.
    const noName = addFromProfileLink(twoProfileList(), link, {}, false);
    if (!noName.ok) throw new Error('expected ok');
    expect(noName.value.list.profiles[2].name).toBe('d.example.com');
  });

  test('a bad link returns the error and leaves the list alone', () => {
    const result = addFromProfileLink(twoProfileList(), 'https://x', env, true);
    expect(result).toEqual({ ok: false, error: { kind: 'scheme' } });
  });
});

describe('updateEntry / renameProfile', () => {
  test('updateEntry transforms one entry by id, selected or not', () => {
    const list = updateEntry(twoProfileList(), 'b', profile =>
      updateProfile(profile, { routingMode: 'general' }),
    );
    expect(list.profiles[1]).toMatchObject({
      id: 'b',
      name: 'Beta',
      routingMode: 'general',
    });
    expect(list.profiles[0]).toEqual(twoProfileList().profiles[0]);
  });

  test('updateEntry with an unknown id is a no-op', () => {
    const list = twoProfileList();
    expect(updateEntry(list, 'nope', () => completeProfile())).toBe(list);
  });

  test('renameProfile persists the new name only', () => {
    const list = renameProfile(twoProfileList(), 'b', 'Backup');
    expect(list.profiles[1].name).toBe('Backup');
    expect({ ...list.profiles[1], name: 'Beta' }).toEqual(
      twoProfileList().profiles[1],
    );
  });
});

describe('deleteProfile', () => {
  test('removes a non-selected entry; selection unchanged', () => {
    const list = deleteProfile(twoProfileList(), 'b');
    expect(list.profiles.map(entry => entry.id)).toEqual(['a']);
    expect(list.selectedId).toBe('a');
  });

  test('deleting the Selected Profile selects another', () => {
    const list = deleteProfile(twoProfileList(), 'a');
    expect(list.profiles.map(entry => entry.id)).toEqual(['b']);
    expect(list.selectedId).toBe('b');
  });

  test('deleting the last profile leaves an empty list with no selection', () => {
    const one = deleteProfile(twoProfileList(), 'b');
    const list = deleteProfile(one, 'a');
    expect(list.profiles).toEqual([]);
    expect(list.selectedId).toBeNull();
  });

  test('unknown id is a no-op', () => {
    const list = twoProfileList();
    expect(deleteProfile(list, 'nope')).toBe(list);
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

  test('v1 entries gain empty Bypass DNS Servers on load (#116)', async () => {
    const list = twoProfileList();
    const stored = {
      ...list,
      profiles: list.profiles.map(({ bypassDnsServers: _omit, ...entry }) => ({
        ...entry,
        version: 1,
      })),
    };
    const { storage } = memoryStorage({
      [PROFILES_STORAGE_KEY]: JSON.stringify(stored),
    });
    const loaded = await loadProfileList(storage, env);
    expect(loaded).toEqual(list);
    expect(loaded.profiles.every(entry => entry.version === 2)).toBe(true);
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
