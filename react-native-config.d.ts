type VpnProtocol = 'Http/2' | 'QUIC';

declare module 'react-native-config' {
  export interface NativeConfig {
    ENV_SERVER_NAME?: string;
    ENV_PROTOCOL?: VpnProtocol;
    ENV_DNS_SERVERS?: string; // Comma-separated list of DNS servers
  }

  export const Config: NativeConfig;
  export default Config;
}
