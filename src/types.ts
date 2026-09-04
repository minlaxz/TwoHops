import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export type VpnProtocol = 'Http/2' | 'QUIC';

export type VpnManagerState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'waitingForRecovery'
  | 'recovering'
  | 'waitingForNetwork';

export type RoutingMode = 'general' | 'selective';

/** Bypass DNS Route — which network a Bypass-side Query travels on. */
export type BypassDnsRoute = 'direct' | 'tunnel';

export interface ServerCredentials {
  name: string;
  ipAddress: string;
  domain: string;
  login: string;
  password: string;
  vpnProtocol: VpnProtocol;
}

/** Server Credentials plus both DNS lists, as handed to the tunnel. */
export interface ServerConfig extends ServerCredentials {
  /** Tunnel DNS Servers — resolvers for Tunnel-side Queries. */
  dnsServers: string[];
  /** Bypass DNS Servers — resolvers for Bypass-side Queries; empty = system. */
  bypassDnsServers: string[];
  /** Bypass DNS Route — meaningless while bypassDnsServers is empty. */
  bypassDnsRoute: BypassDnsRoute;
}

export interface RoutingConfig {
  mode: RoutingMode;
  rules: string[];
}

export interface VpnStartInput {
  server: ServerConfig;
  routing: RoutingConfig;
  /** Omit or leave empty to use the encoder's default LAN exclusions. */
  excludedRoutes?: string[];
}

export type QueryLogAction = 'bypass' | 'tunnel' | 'reject';
export type ConnectionProtocol = 'tcp' | 'udp';

export interface QueryLogRow {
  action: QueryLogAction;
  protocol: ConnectionProtocol;
  source: string;
  destination?: string | null;
  domain?: string | null;
  stamp: Date;
}

export type CustomButtonProps = {
  title?: string;
  disabled?: boolean;
  testID?: string;
  onPress?: () => void;
  touchableOpacityStyles?: StyleProp<ViewStyle>;
  textStyles?: StyleProp<TextStyle>;
};
