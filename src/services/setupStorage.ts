import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoutingMode, ServerConfig } from '../types';

const STORAGE_KEYS = {
  serverName: '@twohops/setup/server/name',
  serverIpAddress: '@twohops/setup/server/ipAddress',
  serverDomain: '@twohops/setup/server/domain',
  serverLogin: '@twohops/setup/server/login',
  serverPassword: '@twohops/setup/server/password',
  serverVpnProtocol: '@twohops/setup/server/vpnProtocol',
  routingMode: '@twohops/setup/routing/mode',
  dnsServersText: '@twohops/setup/dns/serversText',
  localRoutingRulesText: '@twohops/setup/routing/localRulesText',
  remoteRoutingURL: '@twohops/setup/routing/remoteRulesURL',
  rulesText: '@twohops/setup/routing/mergedRulesText',
} as const;

type PersistedSetupConfig = {
  server: ServerConfig;
  routingMode: RoutingMode;
  dnsServersText: string;
  localRoutingRulesText: string;
  remoteRoutingURL: string;
  rulesText: string;
};

const VALID_ROUTING_MODES: RoutingMode[] = ['general', 'selective'];
const VALID_PROTOCOLS: ServerConfig['vpnProtocol'][] = ['Http/2', 'QUIC'];

function isValidRoutingMode(value: string): value is RoutingMode {
  return VALID_ROUTING_MODES.includes(value as RoutingMode);
}

function isValidProtocol(value: string): value is ServerConfig['vpnProtocol'] {
  return VALID_PROTOCOLS.includes(value as ServerConfig['vpnProtocol']);
}

function readString(
  values: Map<string, string | null>,
  key: string,
  fallback: string,
): string {
  const value = values.get(key);
  return value ?? fallback;
}

export async function loadSetupConfig(
  defaults: PersistedSetupConfig,
): Promise<PersistedSetupConfig> {
  try {
    const pairs = await AsyncStorage.multiGet(Object.values(STORAGE_KEYS));
    const values = new Map<string, string | null>(pairs);

    const storedRoutingMode = values.get(STORAGE_KEYS.routingMode);
    const storedProtocol = values.get(STORAGE_KEYS.serverVpnProtocol);

    const dnsServersText = readString(
      values,
      STORAGE_KEYS.dnsServersText,
      defaults.dnsServersText,
    );

    return {
      server: {
        ...defaults.server,
        name: readString(values, STORAGE_KEYS.serverName, defaults.server.name),
        ipAddress: readString(
          values,
          STORAGE_KEYS.serverIpAddress,
          defaults.server.ipAddress,
        ),
        domain: readString(
          values,
          STORAGE_KEYS.serverDomain,
          defaults.server.domain,
        ),
        login: readString(
          values,
          STORAGE_KEYS.serverLogin,
          defaults.server.login,
        ),
        password: readString(
          values,
          STORAGE_KEYS.serverPassword,
          defaults.server.password,
        ),
        vpnProtocol:
          storedProtocol && isValidProtocol(storedProtocol)
            ? storedProtocol
            : defaults.server.vpnProtocol,
      },
      routingMode:
        storedRoutingMode && isValidRoutingMode(storedRoutingMode)
          ? storedRoutingMode
          : defaults.routingMode,
      dnsServersText,
      localRoutingRulesText: readString(
        values,
        STORAGE_KEYS.localRoutingRulesText,
        defaults.localRoutingRulesText,
      ),
      remoteRoutingURL: readString(
        values,
        STORAGE_KEYS.remoteRoutingURL,
        defaults.remoteRoutingURL,
      ),
      rulesText: readString(values, STORAGE_KEYS.rulesText, defaults.rulesText),
    };
  } catch (error) {
    console.error('Failed to load setup config from storage:', error);
    return defaults;
  }
}

export async function saveServerConfig(server: ServerConfig): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.serverName, server.name ?? ''],
    [STORAGE_KEYS.serverIpAddress, server.ipAddress ?? ''],
    [STORAGE_KEYS.serverDomain, server.domain ?? ''],
    [STORAGE_KEYS.serverLogin, server.login ?? ''],
    [STORAGE_KEYS.serverPassword, server.password ?? ''],
    [STORAGE_KEYS.serverVpnProtocol, server.vpnProtocol ?? 'QUIC'],
  ]);
}

export async function saveRoutingMode(routingMode: RoutingMode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.routingMode, routingMode);
}

export async function saveDnsServersText(
  dnsServersText: string,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.dnsServersText, dnsServersText);
}

export async function saveLocalRoutingRulesText(
  localRoutingRulesText: string,
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.localRoutingRulesText,
    localRoutingRulesText,
  );
}

export async function saveRemoteRoutingURL(
  remoteRoutingURL: string,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.remoteRoutingURL, remoteRoutingURL);
}

export async function saveRulesText(rulesText: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.rulesText, rulesText);
}

export async function clearSetupStorage(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
}
