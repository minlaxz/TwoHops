export type VpnProtocol = 'Http/2' | 'QUIC';

export type VpnManagerState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'waitingForRecovery'
  | 'recovering'
  | 'waitingForNetwork';

export type RoutingMode = 'general' | 'selective';


export interface ServerConfig {
  name: string;
  ipAddress: string;
  domain: string;
  login: string;
  password: string;
  vpnProtocol: VpnProtocol;
  dnsServers?: string[];
}

export interface RoutingConfig {
  mode: RoutingMode;
  rules: string[];
}

export interface VpnStartInput {
  server: ServerConfig;
  routing: RoutingConfig;
  excludedRoutes?: string[];
}
