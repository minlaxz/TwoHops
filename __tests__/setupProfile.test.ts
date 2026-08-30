import {
  defaultProfile,
  updateProfile,
  updateServer,
  clearProfile,
  effectiveRules,
  missingFields,
  tunnelStartInput,
  loadProfile,
  saveProfile,
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

describe('defaultProfile', () => {
  test('seeds name, protocol, DNS from env; selective; rest empty', () => {
    expect(defaultProfile(env)).toEqual({
      version: 1,
      server: {
        name: 'env-server',
        ipAddress: '',
        domain: '',
        login: '',
        password: '',
        vpnProtocol: 'Http/2',
      },
      dnsServers: ['1.1.1.1', '8.8.8.8'],
      routingMode: 'selective',
      localRulesText: '',
      remoteRulesURL: '',
      importedRules: [],
      importedAt: null,
    });
  });

  test('empty env yields empty name, QUIC, no DNS', () => {
    const profile = defaultProfile({});
    expect(profile.server.name).toBe('');
    expect(profile.server.vpnProtocol).toBe('QUIC');
    expect(profile.dnsServers).toEqual([]);
  });

  test('clearProfile is defaultProfile', () => {
    expect(clearProfile(env)).toEqual(defaultProfile(env));
  });
});

describe('updateProfile', () => {
  test('shallow patch; does not mutate input', () => {
    const before = defaultProfile(env);
    const after = updateProfile(before, {
      routingMode: 'general',
      dnsServers: ['9.9.9.9'],
    });
    expect(after.routingMode).toBe('general');
    expect(after.dnsServers).toEqual(['9.9.9.9']);
    expect(after.server).toEqual(before.server);
    expect(before.routingMode).toBe('selective');
  });
});

describe('updateServer', () => {
  test('shallow patch on server only', () => {
    const before = defaultProfile(env);
    const after = updateServer(before, { login: 'me' });
    expect(after.server).toEqual({ ...before.server, login: 'me' });
    expect(after.dnsServers).toEqual(before.dnsServers);
    expect(before.server.login).toBe('');
  });
});

describe('effectiveRules', () => {
  test('local first, then imported, deduplicated', () => {
    const profile = updateProfile(defaultProfile(env), {
      localRulesText: 'b.com, a.com\nc.com',
      importedRules: ['a.com', 'd.com', 'c.com'],
    });
    expect(effectiveRules(profile)).toEqual([
      'b.com',
      'a.com',
      'c.com',
      'd.com',
    ]);
  });

  test('empty profile yields no rules', () => {
    expect(effectiveRules(defaultProfile(env))).toEqual([]);
  });
});

describe('missingFields', () => {
  test('default profile misses everything but env-seeded name', () => {
    expect(missingFields(defaultProfile(env))).toEqual([
      'ipAddress',
      'domain',
      'login',
      'password',
    ]);
  });

  test('reports each field individually, including name', () => {
    const profile = updateServer(completeProfile(), { name: '', login: ' ' });
    expect(missingFields(profile)).toEqual(['name', 'login']);
  });

  test('complete profile has none', () => {
    expect(missingFields(completeProfile())).toEqual([]);
  });
});

describe('tunnelStartInput', () => {
  test('complete profile yields server with DNS, routing with effective rules, no excluded routes', () => {
    const profile = updateProfile(completeProfile(), {
      localRulesText: 'a.com',
      importedRules: ['a.com', 'b.com'],
      routingMode: 'general',
    });
    expect(tunnelStartInput(profile)).toEqual({
      ok: true,
      value: {
        server: { ...profile.server, dnsServers: ['1.1.1.1', '8.8.8.8'] },
        routing: { mode: 'general', rules: ['a.com', 'b.com'] },
      },
    });
  });

  test('incomplete profile fails with missing fields', () => {
    expect(tunnelStartInput(defaultProfile(env))).toEqual({
      ok: false,
      error: {
        kind: 'incomplete',
        missing: ['ipAddress', 'domain', 'login', 'password'],
      },
    });
  });
});

describe('saveProfile / loadProfile', () => {
  test('round-trips one JSON document under one key', async () => {
    const { storage, map } = memoryStorage();
    const profile = completeProfile();
    await saveProfile(storage, profile);
    expect([...map.keys()]).toEqual([PROFILE_STORAGE_KEY]);
    expect(JSON.parse(map.get(PROFILE_STORAGE_KEY)!)).toEqual(profile);
    await expect(loadProfile(storage, env)).resolves.toEqual(profile);
  });

  test('fresh install yields defaults, writes nothing', async () => {
    const { storage, map } = memoryStorage();
    await expect(loadProfile(storage, env)).resolves.toEqual(
      defaultProfile(env),
    );
    expect(map.size).toBe(0);
  });

  test('legacy keys migrate to v1 document and are removed', async () => {
    const { storage, map } = memoryStorage({
      [LEGACY_STORAGE_KEYS.serverName]: '',
      [LEGACY_STORAGE_KEYS.serverIpAddress]: '10.0.0.1',
      [LEGACY_STORAGE_KEYS.serverDomain]: 'vpn.example.com',
      [LEGACY_STORAGE_KEYS.serverLogin]: 'user',
      [LEGACY_STORAGE_KEYS.serverPassword]: 'pw',
      [LEGACY_STORAGE_KEYS.serverVpnProtocol]: 'QUIC',
      [LEGACY_STORAGE_KEYS.routingMode]: 'general',
      [LEGACY_STORAGE_KEYS.dnsServersText]: '9.9.9.9, 1.0.0.1',
      [LEGACY_STORAGE_KEYS.localRoutingRulesText]: 'a.com\nb.com',
      [LEGACY_STORAGE_KEYS.remoteRoutingURL]: 'https://x/rules.txt',
      [LEGACY_STORAGE_KEYS.rulesText]: 'a.com\nb.com\nz.com',
    });
    const expected: SetupProfile = {
      version: 1,
      server: {
        name: 'env-server',
        ipAddress: '10.0.0.1',
        domain: 'vpn.example.com',
        login: 'user',
        password: 'pw',
        vpnProtocol: 'QUIC',
      },
      dnsServers: ['9.9.9.9', '1.0.0.1'],
      routingMode: 'general',
      localRulesText: 'a.com\nb.com',
      remoteRulesURL: 'https://x/rules.txt',
      importedRules: [],
      importedAt: null,
    };
    await expect(loadProfile(storage, env)).resolves.toEqual(expected);
    expect([...map.keys()]).toEqual([PROFILE_STORAGE_KEY]);
    expect(JSON.parse(map.get(PROFILE_STORAGE_KEY)!)).toEqual(expected);
  });

  test('partial legacy keys: missing ones fall back to defaults', async () => {
    const { storage } = memoryStorage({
      [LEGACY_STORAGE_KEYS.serverLogin]: 'user',
      [LEGACY_STORAGE_KEYS.routingMode]: 'bogus',
      [LEGACY_STORAGE_KEYS.serverVpnProtocol]: 'bogus',
    });
    const profile = await loadProfile(storage, env);
    expect(profile).toEqual(
      updateServer(defaultProfile(env), { login: 'user' }),
    );
  });

  test('corrupt JSON warns and yields defaults; nothing written', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { storage, map } = memoryStorage({
      [PROFILE_STORAGE_KEY]: '{not json',
    });
    await expect(loadProfile(storage, env)).resolves.toEqual(
      defaultProfile(env),
    );
    expect(map.get(PROFILE_STORAGE_KEY)).toBe('{not json');
    expect(map.size).toBe(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('unknown version warns and yields defaults', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = JSON.stringify({ version: 99 });
    const { storage, map } = memoryStorage({ [PROFILE_STORAGE_KEY]: doc });
    await expect(loadProfile(storage, env)).resolves.toEqual(
      defaultProfile(env),
    );
    expect([...map.entries()]).toEqual([[PROFILE_STORAGE_KEY, doc]]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
