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
