import { encodeConfig } from '../src/services/configEncoder';

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
    },
    routing: {
      mode: 'general',
      rules: ['example.com', '10.0.0.0/8', ' ', 'example.com'],
    },
    excludedRoutes: ['192.168.0.0/16'],
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
  },
  routing: { mode: 'general' as const, rules: [] },
};

test.each([
  ['omitted', {}],
  ['empty array', { excludedRoutes: [] }],
])('excluded_routes falls back to default LAN ranges when %s', (_, extra) => {
  const config = encodeConfig({ ...baseInput, ...extra });
  expect(config).toContain(
    'excluded_routes = ["10.0.0.0/8", "100.64.0.0/10", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.168.0.0/16", "255.255.255.255/32"]',
  );
});

test('explicit excluded routes override the default', () => {
  const config = encodeConfig({ ...baseInput, excludedRoutes: ['1.1.1.0/24'] });
  expect(config).toContain('excluded_routes = ["1.1.1.0/24"]');
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
