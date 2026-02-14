import React, { createContext, useContext, useMemo, useState } from 'react';
import Config from "react-native-config";
import type { RoutingConfig, ServerConfig } from '../types';

type RoutingMode = RoutingConfig['mode'];

type SetupConfigContextValue = {
  server: ServerConfig;
  setServer: React.Dispatch<React.SetStateAction<ServerConfig>>;
  routingMode: RoutingMode;
  setRoutingMode: React.Dispatch<React.SetStateAction<RoutingMode>>;
  rulesText: string;
  setRulesText: React.Dispatch<React.SetStateAction<string>>;
  dnsServersText: string;
  setDnsServersText: React.Dispatch<React.SetStateAction<string>>;
};

const defaultServer: ServerConfig = {
  name: Config.ENV_SERVER_NAME || '',
  ipAddress: '',
  domain: '',
  login: '',
  password: '',
  vpnProtocol: Config.ENV_PROTOCOL || 'QUIC',
  dnsServers: Config.ENV_DNS_SERVERS ? Config.ENV_DNS_SERVERS.split(",") : [],
};

const SetupConfigContext = createContext<SetupConfigContextValue | undefined>(
  undefined,
);

type SetupConfigProviderProps = {
  children: React.ReactNode;
};

export function SetupConfigProvider({ children }: SetupConfigProviderProps) {
  const [server, setServer] = useState<ServerConfig>(defaultServer);
  const [routingMode, setRoutingMode] = useState<RoutingMode>('selective');
  const [rulesText, setRulesText] = useState<string>('');
  const [dnsServersText, setDnsServersText] = useState<string>(
    defaultServer.dnsServers
      ? defaultServer.dnsServers.join(',')
      : ''
  );

  const value = useMemo<SetupConfigContextValue>(
    () => ({
      server,
      setServer,
      routingMode,
      setRoutingMode,
      rulesText,
      setRulesText,
      dnsServersText,
      setDnsServersText,
    }),
    [server, routingMode, rulesText, dnsServersText],
  );

  return (
    <SetupConfigContext.Provider value={value}>
      {children}
    </SetupConfigContext.Provider>
  );
}

export function useSetupConfig(): SetupConfigContextValue {
  const value = useContext(SetupConfigContext);
  if (!value) {
    throw new Error('useSetupConfig must be used inside SetupConfigProvider.');
  }
  return value;
}
