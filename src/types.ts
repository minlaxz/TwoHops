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

/** Server Credentials plus both DNS lists and the Bypass DNS Route, as handed to the tunnel. */
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

/** Advanced Settings (#132, ADR 0008): core knobs the Profile Form never shows. */
export interface AdvancedSettings {
  killSwitch: boolean;
  antiDpi: boolean;
  mtu: number;
  /** `null` emits an empty `upstream_fallback_protocol`. */
  fallbackProtocol: VpnProtocol | null;
  /** Routes kept off the TUN device; stored explicitly, no hidden default. */
  excludedRoutes: string[];
}

export interface VpnStartInput {
  server: ServerConfig;
  routing: RoutingConfig;
  advanced: AdvancedSettings;
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
