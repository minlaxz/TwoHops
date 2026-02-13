import type { ServerConfig, ConfigInput } from '../types';

const DEFAULT_INCLUDED_ROUTES = ['0.0.0.0/0', '2000::/3'];
const DEFAULT_EXCLUDED_ROUTES = ["10.0.0.0/8", "100.64.0.0/10", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.168.0.0/16", "255.255.255.255/32"]
const DEFAULT_TUN_MTU = 1500;

const WILDCARD_PREFIX = '*.';

export function encodeConfig(input: ConfigInput): string {
  const { server, routing, excludedRoutes } = input;

  const logLevel = parseToConfigString('debug');
  const vpnMode = parseToConfigString(routing.mode === 'selective' ? 'selective' : 'general');

  const killSwitchEnabled = true;
  const postQuantumGroupEnabled = false;

  const exclusions = parseToConfigList(expandExclusions(routing.rules));
  const dnsUpStreams = parseToConfigList(server.dnsServers ?? []);
  const hostName = parseToConfigString(server.domain);

  const hasIpv6 = false;
  const addresses = parseHostAddresses([server.ipAddress]);

  const username = parseToConfigString(server.login);
  const password = parseToConfigString(server.password);
  const clientRandom = parseToConfigString('');

  const skipVerification = false;
  const certificate = parseCertificateToString('');

  const upstreamProtocol = parseToConfigString(mapProtocol(server.vpnProtocol));
  const upstreamFallbackProtocol = parseToConfigString('');

  const antiDpi = false;

  const tunIncludedRoutes = parseToConfigList(DEFAULT_INCLUDED_ROUTES);
  const tunExcludedRoutes = parseToConfigList(excludedRoutes ?? DEFAULT_EXCLUDED_ROUTES);
  const tunMtuSize = DEFAULT_TUN_MTU;

  const socksAddress = parseToConfigString('127.0.0.1:1080');
  const socksUsername = parseToConfigString('');
  const socksPassword = parseToConfigString('');

  return buildConfigTemplate({
    logLevel,
    vpnMode,
    killSwitchEnabled,
    postQuantumGroupEnabled,
    exclusions,
    dnsUpStreams,
    hostName,
    addresses,
    hasIpv6,
    username,
    password,
    clientRandom,
    skipVerification,
    certificate,
    upstreamProtocol,
    upstreamFallbackProtocol,
    antiDpi,
    tunIncludedRoutes,
    tunExcludedRoutes,
    tunMtuSize,
    socksAddress,
    socksUsername,
    socksPassword,
  });
}

function mapProtocol(protocol: ServerConfig['vpnProtocol']): string {
  return protocol === 'QUIC' ? 'http3' : 'http2';
}

function expandExclusions(rules: string[]): string[] {
  const domains = new Set<string>();
  const addresses = new Set<string>();

  for (const rule of rules) {
    const normalized = rule.trim();
    if (!normalized) {
      continue;
    }

    if (isDomainLike(normalized)) {
      domains.add(normalized);
      if (!normalized.startsWith(WILDCARD_PREFIX)) {
        domains.add(`${WILDCARD_PREFIX}${normalized}`);
      }
    } else {
      addresses.add(normalized);
    }
  }

  return [...addresses, ...domains];
}

function isDomainLike(value: string): boolean {
  if (value.startsWith('[')) {
    return false;
  }

  if (value.includes('/') || value.includes(':')) {
    return false;
  }

  return value.includes('.') && !value.includes(' ');
}

function parseHostAddresses(addresses: string[]): string {
  return parseToConfigList(addresses.map((address) => parseAddress(address)));
}

function parseAddress(address: string, fallbackPort = 443): string {
  const isIpv6 = (address.match(/:/g)?.length ?? 0) > 1;
  const portDivider = isIpv6 ? ']:' : ':';
  const divided = address.split(portDivider);

  if (divided.length === 1) {
    let withBrackets = address;
    if (isIpv6 && !withBrackets.startsWith('[')) {
      withBrackets = `[${withBrackets}]`;
    }
    return `${withBrackets}:${fallbackPort}`;
  }

  return address;
}

function parseToConfigList(list: Iterable<string | number | boolean | null | undefined>): string {
  const values = Array.from(list)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => parseToConfigString(value));
  return `[${values.join(', ')}]`;
}

function parseToConfigString(value: string | number | boolean): string {
  if (typeof value === 'string') {
    return value.length === 0 ? '""' : `"${value}"`;
  }
  return String(value);
}

function parseCertificateToString(certificate: string): string {
  let certificateCopy = certificate;
  if (certificateCopy.length > 0) {
    certificateCopy = `"\n${certificateCopy}\n"`;
  }
  return parseToConfigString(certificateCopy);
}

type TemplateInput = {
  logLevel: string;
  vpnMode: string;
  killSwitchEnabled: boolean;
  postQuantumGroupEnabled: boolean;
  exclusions: string;
  dnsUpStreams: string;
  hostName: string;
  addresses: string;
  hasIpv6: boolean;
  username: string;
  password: string;
  clientRandom: string;
  skipVerification: boolean;
  certificate: string;
  upstreamProtocol: string;
  upstreamFallbackProtocol: string;
  antiDpi: boolean;
  tunIncludedRoutes: string;
  tunExcludedRoutes: string;
  tunMtuSize: number;
  socksAddress: string;
  socksUsername: string;
  socksPassword: string;
};

// More info on config format can be found in the official documentation of the TrustTunnelClient library
// https://github.com/TrustTunnel/TrustTunnelClient/blob/master/trusttunnel/README.md
function buildConfigTemplate(input: TemplateInput): string {
  return `# Logging level [info, debug, trace]
loglevel = ${input.logLevel}

# VPN mode.
# Defines client connections routing policy:
# * general: route through a VPN endpoint all connections except ones which destinations are in exclusions,
# * selective: route through a VPN endpoint only the connections which destinations are in exclusions.
vpn_mode = ${input.vpnMode}

# When disabled, all connection requests are routed directly to target hosts
# in case connection to VPN endpoint is lost. This helps not to break an
# Internet connection if user has poor connectivity to an endpoint.
# When enabled, incoming connection requests which should be routed through
# an endpoint will not be routed directly in that case.
killswitch_enabled = ${input.killSwitchEnabled}

# When enabled, a post-quantum group may be used for key exchange
# in TLS handshakes initiated by the VPN client.
post_quantum_group_enabled = ${input.postQuantumGroupEnabled}

# Domains and addresses which should be routed in a special manner.
# Supported syntax:
#   * domain name
#     * if starts with "*.", any subdomain of the domain will be matched including
#       www-subdomain, but not the domain itself (e.g., \`*.example.com\`  will match
#       \`sub.example.com\` , \`sub.sub.example.com\` , \`www.example.com\` , but not \`example.com\` )
#     * if starts with "www." or it's just a domain name, the domain itself and its
#       www-subdomain will be matched (e.g. \`example.com\`  and \`www.example.com\`  will
#       match \`example.com\`  \`www.example.com\` , but not \`sub.example.com\` )
#   * ip address
#     * recognized formats are:
#       * [IPv6Address]:port
#       * [IPv6Address]
#       * IPv6Address
#       * IPv4Address:port
#       * IPv4Address
#     * if port is not specified, any port will be matched
#   * CIDR range
#     * recognized formats are:
#       * IPv4Address/mask
#       * IPv6Address/mask
exclusions = ${input.exclusions}

# DNS upstreams.
# If specified, the library intercepts and routes plain DNS queries
# going through the endpoint to the DNS resolvers.
# One of the following kinds:
#   * 8.8.8.8:53 -- plain DNS
#   * tcp://8.8.8.8:53 -- plain DNS over TCP
#   * tls://1.1.1.1 -- DNS-over-TLS
#   * https://dns.adguard.com/dns-query -- DNS-over-HTTPS
#   * sdns://... -- DNS stamp (see https://dnscrypt.info/stamps-specifications)
#   * quic://dns.adguard.com:8853 -- DNS-over-QUIC
dns_upstreams = ${input.dnsUpStreams}

# The set of endpoint connection settings
[endpoint]
# Endpoint host name, used for TLS session establishment
hostname = ${input.hostName}
# Endpoint addresses.
# The exact address is selected by the pinger. Absence of IPv6 addresses in
# the list makes the VPN client reject IPv6 connections which must be routed
# through the endpoint with unreachable code.
addresses = ${input.addresses}
# Whether IPv6 traffic can be routed through the endpoint
has_ipv6 = ${input.hasIpv6}
# Username for authorization
username = ${input.username}
# Password for authorization
password = ${input.password}
# TLS client random prefix (hex string)
client_random = ${input.clientRandom}
# Skip the endpoint certificate verification?
# That is, any certificate is accepted with this one set to true.
skip_verification = ${input.skipVerification}
# Endpoint certificate in PEM format.
# If not specified, the endpoint certificate is verified using the system storage.
certificate = ${input.certificate}
# Protocol to be used to communicate with the endpoint [http2, http3]
upstream_protocol = ${input.upstreamProtocol}
# Fallback protocol to be used in case the main one fails [<none>, http2, http3]
upstream_fallback_protocol = ${input.upstreamFallbackProtocol}
# Is anti-DPI measures should be enabled
anti_dpi = ${input.antiDpi}


# Defines the way to listen to network traffic by the kind of the nested table.
# Possible types:
#   * socks: SOCKS proxy with UDP support,
#   * tun: TUN device.
[listener]

[listener.tun]
# Name of the interface used for connections made by the VPN client.
# On Linux and Windows, it is detected automatically if not specified.
# On macOS, it defaults to \`en0\`  if not specified.
# On Windows, an interface index as shown by \`route print\` , written as a string, may be used instead of a name.
# bound_if = "en0"
# Routes in CIDR notation to set to the virtual interface
included_routes = ${input.tunIncludedRoutes}
# Routes in CIDR notation to exclude from routing through the virtual interface
excluded_routes = ${input.tunExcludedRoutes}
# MTU size on the interface
mtu_size = ${input.tunMtuSize}

# [listener.socks]
# # IP address to bind the listener to
# address = ${input.socksAddress}
# # Username for authentication if desired
# username = ${input.socksUsername}
# # Password for authentication if desired
# password = ${input.socksPassword}
`;
}
