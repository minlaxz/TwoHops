import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Config from 'react-native-config';
import type { RoutingConfig, ServerConfig } from '../types';
import {
  loadSetupConfig,
  saveDnsServersText,
  saveLocalRoutingRulesText,
  saveRemoteRoutingURL,
  saveRoutingMode,
  saveRulesText,
  saveServerConfig,
  clearSetupStorage,
} from '../services/setupStorage';

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
  localRoutingRulesText: string;
  setLocalRoutingRulesText: React.Dispatch<React.SetStateAction<string>>;
  remoteRoutingURL: string;
  setRemoteRoutingURL: React.Dispatch<React.SetStateAction<string>>;
  isHydrated: boolean;
  clearSetupConfig: () => Promise<void>;
};

const defaultServer: ServerConfig = {
  name: Config.ENV_SERVER_NAME || '',
  ipAddress: '',
  domain: '',
  login: '',
  password: '',
  vpnProtocol: Config.ENV_PROTOCOL || 'QUIC',
  dnsServers: Config.ENV_DNS_SERVERS ? Config.ENV_DNS_SERVERS.split(',') : [],
};

const defaultDnsServersText = defaultServer.dnsServers
  ? defaultServer.dnsServers.join(',')
  : '';
const defaultRoutingMode: RoutingMode = 'selective';

function getDefaultSetupState() {
  return {
    server: defaultServer,
    routingMode: defaultRoutingMode,
    dnsServersText: defaultDnsServersText,
    localRoutingRulesText: '',
    remoteRoutingURL: '',
    rulesText: '',
  };
}

const SetupConfigContext = createContext<SetupConfigContextValue | undefined>(
  undefined,
);

type SetupConfigProviderProps = {
  children: React.ReactNode;
};

export function SetupConfigProvider({ children }: SetupConfigProviderProps) {
  const [server, setServer] = useState<ServerConfig>(defaultServer);
  const [routingMode, setRoutingMode] =
    useState<RoutingMode>(defaultRoutingMode);
  const [rulesText, setRulesText] = useState<string>('');
  const [dnsServersText, setDnsServersText] = useState<string>(
    defaultDnsServersText,
  );
  const [localRoutingRulesText, setLocalRoutingRulesText] =
    useState<string>('');
  const [remoteRoutingURL, setRemoteRoutingURL] = useState<string>('');
  const [isHydrated, setIsHydrated] = useState(false);

  const clearSetupConfig = useCallback(async () => {
    const defaults = getDefaultSetupState();

    try {
      await clearSetupStorage();
    } catch (error) {
      console.error('Failed to clear setup storage:', error);
    }

    setServer(defaults.server);
    setRoutingMode(defaults.routingMode);
    setDnsServersText(defaults.dnsServersText);
    setLocalRoutingRulesText(defaults.localRoutingRulesText);
    setRemoteRoutingURL(defaults.remoteRoutingURL);
    setRulesText(defaults.rulesText);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateSetupConfig = async () => {
      const defaults = getDefaultSetupState();

      const persisted = await loadSetupConfig(defaults);

      if (cancelled) {
        return;
      }

      setServer(persisted.server);
      setRoutingMode(persisted.routingMode);
      setDnsServersText(persisted.dnsServersText);
      setLocalRoutingRulesText(persisted.localRoutingRulesText);
      setRemoteRoutingURL(persisted.remoteRoutingURL);
      setRulesText(persisted.rulesText);
      setIsHydrated(true);
    };

    hydrateSetupConfig().catch(error => {
      console.error('Failed to hydrate setup config:', error);
      if (!cancelled) {
        setIsHydrated(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveServerConfig(server).catch(error => {
      console.error('Failed to save server config:', error);
    });
  }, [isHydrated, server]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveRoutingMode(routingMode).catch(error => {
      console.error('Failed to save routing mode:', error);
    });
  }, [isHydrated, routingMode]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveDnsServersText(dnsServersText).catch(error => {
      console.error('Failed to save DNS servers:', error);
    });
  }, [dnsServersText, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveLocalRoutingRulesText(localRoutingRulesText).catch(error => {
      console.error('Failed to save local routing rules:', error);
    });
  }, [isHydrated, localRoutingRulesText]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveRemoteRoutingURL(remoteRoutingURL).catch(error => {
      console.error('Failed to save remote rules URL:', error);
    });
  }, [isHydrated, remoteRoutingURL]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    saveRulesText(rulesText).catch(error => {
      console.error('Failed to save merged rules text:', error);
    });
  }, [isHydrated, rulesText]);

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
      localRoutingRulesText,
      setLocalRoutingRulesText,
      remoteRoutingURL,
      setRemoteRoutingURL,
      isHydrated,
      clearSetupConfig,
    }),
    [
      server,
      routingMode,
      rulesText,
      dnsServersText,
      localRoutingRulesText,
      remoteRoutingURL,
      isHydrated,
      clearSetupConfig,
    ],
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
