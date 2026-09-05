import {
  defaultProfile,
  updateProfile,
  updateServer,
  clearProfile,
  applyProfileLink,
  profileLink,
  effectiveRules,
  addLocalRule,
  hasEffectiveRule,
  offerableLocalRule,
  importRemoteRules,
  missingFields,
  splitHostPort,
  joinHostPort,
  tunnelStartInput,
  loadProfile,
  saveProfile,
  PROFILE_STORAGE_KEY,
  LEGACY_STORAGE_KEYS,
  DEFAULT_ADVANCED_SETTINGS,
  migrateProfileDocument,
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
      version: 4,
      server: {
        name: 'env-server',
        ipAddress: '',
        domain: '',
        login: '',
        password: '',
        vpnProtocol: 'Http/2',
      },
      dnsServers: ['1.1.1.1', '8.8.8.8'],
      bypassDnsSource: 'same-as-tunnel',
      bypassDnsServers: [],
      bypassDnsRoute: 'tunnel',
      routingMode: 'selective',
      localRulesText: '',
      remoteRulesURL: '',
      importedRules: [],
      importedAt: null,
      advanced: {
        killSwitch: true,
        antiDpi: false,
        mtu: 1500,
        fallbackProtocol: null,
        excludedRoutes: [
          '10.0.0.0/8',
          '100.64.0.0/10',
          '169.254.0.0/16',
          '172.16.0.0/12',
          '192.0.0.0/24',
          '192.168.0.0/16',
          '255.255.255.255/32',
        ],
      },
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

describe('addLocalRule / hasRule (#98)', () => {
  test('appends to Local Rules and becomes effective', () => {
    const profile = updateProfile(defaultProfile(env), {
      localRulesText: 'a.com',
    });
    const next = addLocalRule(profile, 'facebook.com');
    expect(next.localRulesText).toBe('a.com\nfacebook.com');
    expect(hasEffectiveRule(next, 'facebook.com')).toBe(true);
  });

  test('empty Local Rules gets the rule alone', () => {
    expect(addLocalRule(defaultProfile(env), 'a.com').localRulesText).toBe(
      'a.com',
    );
  });

  test('already listed (local or imported) is a no-op', () => {
    const profile = updateProfile(defaultProfile(env), {
      localRulesText: 'a.com',
      importedRules: ['b.com'],
    });
    expect(hasEffectiveRule(profile, 'a.com')).toBe(true);
    expect(hasEffectiveRule(profile, 'b.com')).toBe(true);
    expect(hasEffectiveRule(profile, 'c.com')).toBe(false);
    expect(addLocalRule(profile, 'a.com')).toBe(profile);
    expect(addLocalRule(profile, 'b.com')).toBe(profile);
  });

  test('wildcard and case variants count as listed', () => {
    const profile = updateProfile(defaultProfile(env), {
      localRulesText: '*.Facebook.com',
    });
    expect(hasEffectiveRule(profile, 'facebook.com')).toBe(true);
    expect(addLocalRule(profile, 'facebook.com')).toBe(profile);
  });
});

describe('offerableLocalRule (#98)', () => {
  const selective = updateProfile(defaultProfile(env), {
    localRulesText: 'listed.com',
  });
  const bypass = (domain: string | null) => ({
    action: 'bypass' as const,
    domain,
  });

  test('bypass row in selective mode offers the collapsed domain', () => {
    expect(offerableLocalRule(selective, bypass('www.facebook.com'))).toBe(
      'facebook.com',
    );
  });

  test('null for tunnel rows, listed domains, general mode, non-hostnames', () => {
    expect(
      offerableLocalRule(selective, { action: 'tunnel', domain: 'x.com' }),
    ).toBeNull();
    expect(offerableLocalRule(selective, bypass('cdn.listed.com'))).toBeNull();
    expect(
      offerableLocalRule(
        updateProfile(selective, { routingMode: 'general' }),
        bypass('y.com'),
      ),
    ).toBeNull();
    expect(offerableLocalRule(selective, bypass('1.2.3.4'))).toBeNull();
    expect(offerableLocalRule(selective, bypass(null))).toBeNull();
    expect(offerableLocalRule(selective, bypass('localhost'))).toBeNull();
  });

  test('trailing-dot FQDN is trimmed', () => {
    expect(offerableLocalRule(selective, bypass('example.com.'))).toBe(
      'example.com',
    );
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

  test('port in the server address must be an integer 1–65535; empty port is 443 (#125)', () => {
    const withPort = (ipAddress: string) =>
      missingFields(updateServer(completeProfile(), { ipAddress }));
    expect(withPort('10.0.0.1:8443')).toEqual([]);
    expect(withPort('10.0.0.1:')).toEqual([]);
    expect(withPort('10.0.0.1:0')).toEqual(['port']);
    expect(withPort('10.0.0.1:65536')).toEqual(['port']);
    expect(withPort('10.0.0.1:abc')).toEqual(['port']);
    expect(withPort('10.0.0.1:4.4')).toEqual(['port']);
  });
});

describe('splitHostPort / joinHostPort', () => {
  test('splits the one-colon form and round-trips through join (#126)', () => {
    expect(splitHostPort('10.0.0.1:8443')).toEqual({
      host: '10.0.0.1',
      port: '8443',
    });
    expect(splitHostPort('10.0.0.1')).toEqual({ host: '10.0.0.1', port: '' });
    expect(splitHostPort('10.0.0.1:')).toEqual({ host: '10.0.0.1', port: '' });
    // Not the one-colon form: shown whole, no port (IPv6 out of scope).
    expect(splitHostPort('::1')).toEqual({ host: '::1', port: '' });
    // Port typed before the host (#126): the port survives, the address is
    // what is missing.
    expect(splitHostPort(':443')).toEqual({ host: '', port: '443' });
    expect(
      missingFields(updateServer(completeProfile(), { ipAddress: ':443' })),
    ).toEqual(['ipAddress']);
    expect(joinHostPort('10.0.0.1', '8443')).toBe('10.0.0.1:8443');
    expect(joinHostPort('10.0.0.1', '')).toBe('10.0.0.1');
    expect(joinHostPort('10.0.0.1', 'abc')).toBe('10.0.0.1:abc');
  });
});

describe('tunnelStartInput', () => {
  test('complete profile yields server with DNS, routing with effective rules, Advanced Settings', () => {
    const profile = updateProfile(completeProfile(), {
      localRulesText: 'a.com',
      importedRules: ['a.com', 'b.com'],
      routingMode: 'general',
      bypassDnsSource: 'custom',
      bypassDnsServers: ['https://dns.adguard.com/dns-query'],
      bypassDnsRoute: 'direct',
    });
    expect(tunnelStartInput(profile)).toEqual({
      ok: true,
      value: {
        server: {
          ...profile.server,
          dnsServers: ['1.1.1.1', '8.8.8.8'],
          bypassDnsServers: ['https://dns.adguard.com/dns-query'],
          bypassDnsRoute: 'direct',
        },
        routing: { mode: 'general', rules: ['a.com', 'b.com'] },
        advanced: DEFAULT_ADVANCED_SETTINGS,
      },
    });
  });

  test('hands the profile Advanced Settings to the core as-is (#132)', () => {
    const advanced = {
      killSwitch: false,
      antiDpi: true,
      mtu: 1280,
      fallbackProtocol: 'Http/2' as const,
      excludedRoutes: [],
    };
    const input = tunnelStartInput(
      updateProfile(completeProfile(), { advanced }),
    );
    expect(input.ok && input.value.advanced).toEqual(advanced);
  });

  test('same-as-tunnel hands the Tunnel DNS Servers as the Bypass DNS Servers; the core never sees the flag (#125)', () => {
    const profile = updateProfile(completeProfile(), {
      bypassDnsServers: ['9.9.9.9'], // stale custom list, ignored
    });
    const input = tunnelStartInput(profile);
    expect(input.ok).toBe(true);
    if (!input.ok) return;
    expect(input.value.server.bypassDnsServers).toEqual(['1.1.1.1', '8.8.8.8']);
    expect(input.value.server.bypassDnsRoute).toBe('tunnel');
    expect(input.value.server).not.toHaveProperty('bypassDnsSource');
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

  test('legacy keys migrate to the current document and are removed', async () => {
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
      version: 4,
      server: {
        name: 'env-server',
        ipAddress: '10.0.0.1',
        domain: 'vpn.example.com',
        login: 'user',
        password: 'pw',
        vpnProtocol: 'QUIC',
      },
      dnsServers: ['9.9.9.9', '1.0.0.1'],
      bypassDnsSource: 'custom',
      bypassDnsServers: [],
      bypassDnsRoute: 'direct',
      routingMode: 'general',
      localRulesText: 'a.com\nb.com',
      remoteRulesURL: 'https://x/rules.txt',
      importedRules: [],
      importedAt: null,
      advanced: DEFAULT_ADVANCED_SETTINGS,
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
      updateProfile(updateServer(defaultProfile(env), { login: 'user' }), {
        // legacy layouts are existing profiles: system resolvers, direct
        bypassDnsSource: 'custom',
        bypassDnsRoute: 'direct',
      }),
    );
  });

  test('v1 document loads as v3 with empty custom Bypass DNS Servers and direct route (#116, #117, #125)', async () => {
    const v1: Partial<SetupProfile> = { ...completeProfile() };
    delete v1.bypassDnsServers;
    delete v1.bypassDnsRoute;
    delete v1.bypassDnsSource;
    delete v1.advanced;
    const { storage } = memoryStorage({
      [PROFILE_STORAGE_KEY]: JSON.stringify({ ...v1, version: 1 }),
    });
    await expect(loadProfile(storage, env)).resolves.toEqual({
      ...completeProfile(),
      version: 4,
      advanced: DEFAULT_ADVANCED_SETTINGS,
      bypassDnsSource: 'custom',
      bypassDnsServers: [],
      bypassDnsRoute: 'direct',
    });
  });

  test('v2 document without the source loads as custom, keeping its list and route (#125)', async () => {
    const v2: Partial<SetupProfile> = {
      ...completeProfile(),
      bypassDnsServers: ['9.9.9.9'],
      bypassDnsRoute: 'tunnel',
    };
    delete v2.bypassDnsSource;
    delete v2.advanced;
    const { storage } = memoryStorage({
      [PROFILE_STORAGE_KEY]: JSON.stringify({ ...v2, version: 2 }),
    });
    await expect(loadProfile(storage, env)).resolves.toEqual({
      ...completeProfile(),
      version: 4,
      advanced: DEFAULT_ADVANCED_SETTINGS,
      bypassDnsSource: 'custom',
      bypassDnsServers: ['9.9.9.9'],
      bypassDnsRoute: 'tunnel',
    });
  });

  test('v3 document loads as v4 with Advanced Settings equal to the old constants (#132)', async () => {
    const v3: Partial<SetupProfile> = { ...completeProfile() };
    delete v3.advanced;
    const { storage } = memoryStorage({
      [PROFILE_STORAGE_KEY]: JSON.stringify({ ...v3, version: 3 }),
    });
    await expect(loadProfile(storage, env)).resolves.toEqual({
      ...completeProfile(),
      version: 4,
      advanced: DEFAULT_ADVANCED_SETTINGS,
    });
  });

  test('v4 document keeps its own Advanced Settings (#132)', () => {
    const advanced = {
      killSwitch: false,
      antiDpi: true,
      mtu: 1400,
      fallbackProtocol: 'QUIC' as const,
      excludedRoutes: ['1.1.1.0/24'],
    };
    const doc = { ...completeProfile(), advanced };
    expect(migrateProfileDocument(JSON.parse(JSON.stringify(doc)))).toEqual(
      doc,
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

describe('profileLink', () => {
  test('encodes every carried field, URL-escaped, dns comma-joined', () => {
    const profile = updateProfile(
      updateServer(completeProfile(), {
        login: 'u 2',
        password: 'p==&x',
        ipAddress: '1.2.3.4',
        domain: 'tls.example.com',
        vpnProtocol: 'Http/2',
      }),
      {
        dnsServers: ['https://dns.nextdns.io', '1.1.1.1'],
        remoteRulesURL: 'https://r.example.com/rules.txt',
      },
    );
    expect(profileLink(profile)).toBe(
      'twohops://?login=u%202&password=p%3D%3D%26x&ip=1.2.3.4' +
        '&domain=tls.example.com&protocol=Http%2F2' +
        '&dns=https%3A%2F%2Fdns.nextdns.io%2C1.1.1.1' +
        '&remoteRules=https%3A%2F%2Fr.example.com%2Frules.txt',
    );
  });

  test('omits empty fields; name, routing mode and local rules never travel', () => {
    const profile = updateProfile(
      updateServer(defaultProfile(env), { name: 'Only', login: 'me' }),
      { dnsServers: [], routingMode: 'general', localRulesText: 'a.com' },
    );
    expect(profileLink(profile)).toBe('twohops://?login=me&protocol=Http%2F2');
  });

  test('round-trips through applyProfileLink', () => {
    const shared = updateProfile(
      updateServer(completeProfile(), { password: 'p==&x?#', login: 'u 2' }),
      { dnsServers: ['1.1.1.1', '8.8.8.8'], remoteRulesURL: 'https://r/x' },
    );
    const result = applyProfileLink(defaultProfile(env), profileLink(shared));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The link never carries the name; the target keeps its own (env) name.
    expect(result.value.server).toEqual({
      ...shared.server,
      name: 'env-server',
    });
    expect(result.value.dnsServers).toEqual(shared.dnsServers);
    expect(result.value.remoteRulesURL).toBe(shared.remoteRulesURL);
  });

  test('carries bypassDns and bypassDnsRoute only when custom and non-empty; round-trips (#117, #125)', () => {
    const shared = updateProfile(completeProfile(), {
      bypassDnsSource: 'custom',
      bypassDnsServers: ['https://dns.adguard.com/dns-query', '9.9.9.9'],
      bypassDnsRoute: 'tunnel',
    });
    const link = profileLink(shared);
    expect(link).toContain(
      '&bypassDns=https%3A%2F%2Fdns.adguard.com%2Fdns-query%2C9.9.9.9',
    );
    expect(link).toContain('&bypassDnsRoute=tunnel');
    const result = applyProfileLink(defaultProfile(env), link);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.bypassDnsSource).toBe('custom');
    expect(result.value.bypassDnsServers).toEqual(shared.bypassDnsServers);
    expect(result.value.bypassDnsRoute).toBe('tunnel');

    const empty = profileLink(
      updateProfile(completeProfile(), {
        bypassDnsSource: 'custom',
        bypassDnsRoute: 'tunnel',
      }),
    );
    expect(empty).not.toContain('bypassDns');

    // same-as-tunnel: the recipient gets follow-live, not a snapshot.
    const same = profileLink(
      updateProfile(completeProfile(), {
        bypassDnsServers: ['9.9.9.9'],
        bypassDnsRoute: 'direct',
      }),
    );
    expect(same).not.toContain('bypassDns');
  });
});

describe('applyProfileLink', () => {
  const base = completeProfile();

  test('link without bypass params leaves source, list and route as they are; bogus route ignored (#117, #125)', () => {
    const result = applyProfileLink(base, 'twohops://x?login=a');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.bypassDnsSource).toBe('same-as-tunnel');
    expect(result.value.bypassDnsServers).toEqual([]);
    expect(result.value.bypassDnsRoute).toBe('tunnel');
    const custom = updateProfile(base, {
      bypassDnsSource: 'custom',
      bypassDnsServers: ['9.9.9.9'],
    });
    const kept = applyProfileLink(custom, 'twohops://x?login=a');
    expect(kept.ok && kept.value.bypassDnsSource).toBe('custom');
    expect(kept.ok && kept.value.bypassDnsServers).toEqual(['9.9.9.9']);
    const bogus = applyProfileLink(base, 'twohops://x?bypassDnsRoute=bogus');
    expect(bogus.ok && bogus.value.bypassDnsRoute).toBe('tunnel');
  });

  test('link with bypassDns lands as a custom list (#125)', () => {
    const result = applyProfileLink(base, 'twohops://x?bypassDns=9.9.9.9');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.bypassDnsSource).toBe('custom');
    expect(result.value.bypassDnsServers).toEqual(['9.9.9.9']);
  });

  test('wrong scheme is an error', () => {
    expect(applyProfileLink(base, 'https://x?login=a')).toEqual({
      ok: false,
      error: { kind: 'scheme' },
    });
  });

  test('malformed link is an error', () => {
    expect(applyProfileLink(base, 'not a url')).toEqual({
      ok: false,
      error: { kind: 'malformed' },
    });
    expect(applyProfileLink(base, '').ok).toBe(false);
  });

  test('full link overwrites every carried field', () => {
    const url =
      'twohops://import-profile?login=u2&password=p%3D%3D&ip=1.2.3.4' +
      '&domain=tls.example.com&protocol=Http%2F2' +
      '&dns=https://dns.nextdns.io,1.1.1.1&remoteRules=https://r.example.com/rules.txt';
    const result = applyProfileLink(base, url);
    expect(result).toEqual({
      ok: true,
      value: {
        ...base,
        server: {
          ...base.server,
          login: 'u2',
          password: 'p==',
          ipAddress: '1.2.3.4',
          domain: 'tls.example.com',
          vpnProtocol: 'Http/2',
        },
        dnsServers: ['https://dns.nextdns.io', '1.1.1.1'],
        remoteRulesURL: 'https://r.example.com/rules.txt',
      },
    });
    expect(base.server.login).toBe('user');
  });

  test('partial link changes only carried fields', () => {
    const result = applyProfileLink(base, 'twohops://x?ip=9.9.9.9&dns=8.8.8.8');
    expect(result).toEqual({
      ok: true,
      value: {
        ...base,
        server: { ...base.server, ipAddress: '9.9.9.9' },
        dnsServers: ['8.8.8.8'],
      },
    });
  });

  test('unknown protocol value is ignored', () => {
    const result = applyProfileLink(base, 'twohops://x?protocol=bogus');
    expect(result).toEqual({ ok: true, value: base });
  });

  // A Profile Link cannot carry the server name; an empty one defaults from
  // the link's domain so the link alone reaches Profile Completeness.
  describe('server name defaulting', () => {
    const nameless = updateServer(base, { name: '' });

    test('empty server name defaults from the link domain', () => {
      const result = applyProfileLink(
        nameless,
        'twohops://x?domain=tls.example.com',
      );
      if (!result.ok) throw new Error('expected ok');
      expect(result.value.server.name).toBe('tls.example.com');
      expect(result.value.server.domain).toBe('tls.example.com');
    });

    test('a link without a domain leaves the empty name alone', () => {
      const result = applyProfileLink(nameless, 'twohops://x?login=bob');
      if (!result.ok) throw new Error('expected ok');
      expect(result.value.server.name).toBe('');
    });

    test('an existing server name is never overwritten', () => {
      const result = applyProfileLink(
        base,
        'twohops://x?domain=tls.example.com',
      );
      if (!result.ok) throw new Error('expected ok');
      expect(result.value.server.name).toBe(base.server.name);
    });
  });
});

describe('importRemoteRules', () => {
  const okFetch = (body: string) => () =>
    Promise.resolve({
      ok: true,
      statusText: 'OK',
      text: () => Promise.resolve(body),
    });
  const base = updateProfile(completeProfile(), {
    localRulesText: 'a.com',
    remoteRulesURL: ' https://x/rules.txt ',
    importedRules: ['old.com'],
    importedAt: '2020-01-01T00:00:00.000Z',
  });

  test('success stores Imported Rules and an ISO importedAt', async () => {
    const before = Date.now();
    const result = await importRemoteRules(
      base,
      okFetch('b.com\nc.com') as any,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.importedRules).toEqual(['b.com', 'c.com']);
    expect(Date.parse(result.value.importedAt!)).toBeGreaterThanOrEqual(before);
    expect(result.value.importedAt).toBe(
      new Date(result.value.importedAt!).toISOString(),
    );
    expect({ ...result.value, importedRules: 0, importedAt: 0 }).toEqual({
      ...base,
      importedRules: 0,
      importedAt: 0,
    });
    expect(base.importedRules).toEqual(['old.com']);
  });

  test('fetch is called with the trimmed URL', async () => {
    const fetchImpl = jest.fn(okFetch(''));
    await importRemoteRules(base, fetchImpl as any);
    expect(fetchImpl).toHaveBeenCalledWith('https://x/rules.txt');
  });

  test('failed fetch is an error; previous Imported Rules kept', async () => {
    const fetchImpl = () => Promise.reject(new Error('offline'));
    await expect(importRemoteRules(base, fetchImpl as any)).resolves.toEqual({
      ok: false,
      error: { kind: 'fetch', message: 'offline' },
    });
    expect(base.importedRules).toEqual(['old.com']);
    expect(base.importedAt).toBe('2020-01-01T00:00:00.000Z');
  });

  test('non-OK response is an error', async () => {
    const fetchImpl = () =>
      Promise.resolve({ ok: false, statusText: 'Not Found', text: () => '' });
    const result = await importRemoteRules(base, fetchImpl as any);
    expect(result).toEqual({
      ok: false,
      error: { kind: 'fetch', message: expect.stringContaining('Not Found') },
    });
  });

  test('empty Remote Rules URL is an error; fetch never called', async () => {
    const fetchImpl = jest.fn();
    await expect(
      importRemoteRules(
        updateProfile(base, { remoteRulesURL: '  ' }),
        fetchImpl as any,
      ),
    ).resolves.toEqual({ ok: false, error: { kind: 'noURL' } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('import, go offline, connect: tunnel gets Local + Imported rules', async () => {
    const imported = await importRemoteRules(
      base,
      okFetch('a.com\nz.com') as any,
    );
    if (!imported.ok) throw new Error('import failed');
    // tunnelStartInput is synchronous and takes no fetch: connect is offline.
    const start = tunnelStartInput(imported.value);
    expect(start).toEqual({
      ok: true,
      value: expect.objectContaining({
        routing: { mode: 'selective', rules: ['a.com', 'z.com'] },
      }),
    });
  });
});
