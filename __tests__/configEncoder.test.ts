import { encodeConfig } from '../src/services/configEncoder';
import { DEFAULT_ADVANCED_SETTINGS } from '../src/services/setupProfile';

test('exclusions line uses expanded Routing Rules (addresses first, then domains + wildcards)', () => {
  const config = encodeConfig({
    server: {
      name: 'srv',
      ipAddress: '1.2.3.4',
      domain: 'vpn.example.com',
      login: 'u',
      password: 'p',
      vpnProtocol: 'QUIC',
      dnsServers: [],
      bypassDnsServers: [],
      bypassDnsRoute: 'direct',
    },
    routing: {
      mode: 'general',
      rules: ['example.com', '10.0.0.0/8', ' ', 'example.com'],
    },
    advanced: {
      ...DEFAULT_ADVANCED_SETTINGS,
      excludedRoutes: ['192.168.0.0/16'],
    },
  });

  expect(config).toContain(
    'exclusions = ["10.0.0.0/8", "example.com", "*.example.com"]',
  );
  expect(config).toContain('excluded_routes = ["192.168.0.0/16"]');
  expect(config).toContain('upstream_protocol = "http3"');
});

const baseInput = {
  server: {
    name: 'srv',
    ipAddress: '1.2.3.4',
    domain: 'vpn.example.com',
    login: 'u',
    password: 'p',
    vpnProtocol: 'QUIC' as const,
    dnsServers: [],
    bypassDnsServers: [],
    bypassDnsRoute: 'direct' as const,
  },
  routing: { mode: 'general' as const, rules: [] },
  advanced: DEFAULT_ADVANCED_SETTINGS,
};

const withAdvanced = (patch: Partial<typeof DEFAULT_ADVANCED_SETTINGS>) =>
  encodeConfig({
    ...baseInput,
    advanced: { ...DEFAULT_ADVANCED_SETTINGS, ...patch },
  });

test('default Advanced Settings encode exactly the old constants (#132)', () => {
  const config = encodeConfig(baseInput);
  expect(config).toContain('killswitch_enabled = true');
  expect(config).toContain('anti_dpi = false');
  expect(config).toContain('mtu_size = 1500');
  expect(config).toContain('upstream_fallback_protocol = ""');
  expect(config).toContain(
    'excluded_routes = ["10.0.0.0/8", "100.64.0.0/10", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.168.0.0/16", "255.255.255.255/32"]',
  );
});

test.each([
  ['killSwitch', { killSwitch: false }, 'killswitch_enabled = false'],
  ['antiDpi', { antiDpi: true }, 'anti_dpi = true'],
  ['mtu', { mtu: 1280 }, 'mtu_size = 1280'],
  [
    'fallbackProtocol QUIC',
    { fallbackProtocol: 'QUIC' as const },
    'upstream_fallback_protocol = "http3"',
  ],
  [
    'fallbackProtocol Http/2',
    { fallbackProtocol: 'Http/2' as const },
    'upstream_fallback_protocol = "http2"',
  ],
  [
    'excludedRoutes',
    { excludedRoutes: ['1.1.1.0/24'] },
    'excluded_routes = ["1.1.1.0/24"]',
  ],
])('%s changes its core config line (#132)', (_, patch, line) => {
  expect(withAdvanced(patch)).toContain(line);
});

test('empty excluded routes stay empty; no hidden default (#132)', () => {
  const config = withAdvanced({ excludedRoutes: [] });
  expect(config).toContain('excluded_routes = []');
  expect(config).not.toContain('10.0.0.0/8');
});

test('direct_dns_upstreams sits under [endpoint] beside dns_upstreams, same quoting (#116)', () => {
  const config = encodeConfig({
    ...baseInput,
    server: {
      ...baseInput.server,
      dnsServers: ['tls://1.1.1.1'],
      bypassDnsServers: ['https://dns.adguard.com/dns-query', '9.9.9.9:53'],
    },
  });

  const endpoint = config.indexOf('[endpoint]');
  const dns = config.indexOf('dns_upstreams = ["tls://1.1.1.1"]');
  const direct = config.indexOf(
    'direct_dns_upstreams = ["https://dns.adguard.com/dns-query", "9.9.9.9:53"]',
  );
  const listener = config.indexOf('[listener]');

  expect(dns).toBeGreaterThan(endpoint);
  expect(direct).toBeGreaterThan(dns);
  expect(direct).toBeLessThan(listener);
});

test('empty Bypass DNS Servers encodes as an empty list', () => {
  expect(encodeConfig(baseInput)).toContain('direct_dns_upstreams = []');
});

test('direct_dns_via_tunnel is true only with a non-empty list and Tunnel route (#117)', () => {
  const withRoute = (
    bypassDnsServers: string[],
    bypassDnsRoute: 'direct' | 'tunnel',
  ) =>
    encodeConfig({
      ...baseInput,
      server: { ...baseInput.server, bypassDnsServers, bypassDnsRoute },
    });
  expect(withRoute(['9.9.9.9'], 'tunnel')).toContain(
    'direct_dns_via_tunnel = true',
  );
  expect(withRoute(['9.9.9.9'], 'direct')).toContain(
    'direct_dns_via_tunnel = false',
  );
  expect(withRoute([], 'tunnel')).toContain('direct_dns_via_tunnel = false');
});

test('dns_upstreams lives under [endpoint] (trusttunnel-client >= 1.0.45 ignores root-level key)', () => {
  const config = encodeConfig({
    ...baseInput,
    server: { ...baseInput.server, dnsServers: ['tls://1.1.1.1'] },
  });

  const endpoint = config.indexOf('[endpoint]');
  const dns = config.indexOf('dns_upstreams = ["tls://1.1.1.1"]');
  const listener = config.indexOf('[listener]');

  expect(endpoint).toBeGreaterThan(-1);
  expect(dns).toBeGreaterThan(endpoint);
  expect(dns).toBeLessThan(listener);
});
