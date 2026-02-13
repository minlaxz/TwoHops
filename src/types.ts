import type { StyleProp, TextStyle, ViewStyle } from "react-native";

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

export type ConfigInput = {
  server: ServerConfig;
  routing: RoutingConfig;
  excludedRoutes: string[];
};

export interface VpnStartInput {
  server: ServerConfig;
  routing: RoutingConfig;
  excludedRoutes?: string[];
}

export type VpnManagerStateDescriptor = {
  statusText: string;
  statusEmoji: string;
  action: () => Promise<void>;
  actionText: string;
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
  onPress?: () => void;
  touchableOpacityStyles?: StyleProp<ViewStyle>;
  textStyles?: StyleProp<TextStyle>;
};
