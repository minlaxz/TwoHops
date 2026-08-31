type VpnProtocol = 'Http/2' | 'QUIC';

declare module 'react-native-config' {
  export interface NativeConfig {
    ENV_SERVER_NAME?: string;
    ENV_PROTOCOL?: VpnProtocol;
    ENV_DNS_SERVERS?: string; // Comma-separated list of DNS servers
    ENV_BUILD_NUMBER?: string; // CI-injected build number; unset in local dev
  }

  export const Config: NativeConfig;
  export default Config;
}
