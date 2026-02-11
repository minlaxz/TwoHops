import React, { createContext, useContext, useMemo, useState } from 'react';
import type { RoutingConfig, ServerConfig } from '../services';

type RoutingMode = RoutingConfig['mode'];

type SetupConfigContextValue = {
    server: ServerConfig;
    setServer: React.Dispatch<React.SetStateAction<ServerConfig>>;
    routingMode: RoutingMode;
    setRoutingMode: React.Dispatch<React.SetStateAction<RoutingMode>>;
    localRoutingRulesText: string;
    setLocalRoutingRulesText: React.Dispatch<React.SetStateAction<string>>;
    remoteRoutingURL: string;
    setRemoteRoutingURL: React.Dispatch<React.SetStateAction<string>>;
    dnsServersText: string;
    setDnsServersText: React.Dispatch<React.SetStateAction<string>>;
};

// TODO: Default server configuration for initial state (temporary data, will be replaced later)
const defaultServer: ServerConfig = {
    name: 'lssg',
    ipAddress: '13.251.208.16',
    domain: 'trusted-1.minlaxz.lol',
    login: 'minlaxz',
    password: '000111222.@gG',
    vpnProtocol: 'QUIC',
    dnsServers: [],
};

const SetupConfigContext = createContext<SetupConfigContextValue | undefined>(undefined);

type SetupConfigProviderProps = {
    children: React.ReactNode;
};

export function SetupConfigProvider({ children }: SetupConfigProviderProps) {
    const [server, setServer] = useState<ServerConfig>(defaultServer);
    const [routingMode, setRoutingMode] = useState<RoutingMode>('selective');
    const [localRoutingRulesText, setLocalRoutingRulesText] = useState<string>('myip.wtf');
    const [remoteRoutingURL, setRemoteRoutingURL] = useState<string>('https://pastebin.com/raw/hHdVMwyW');
    const [dnsServersText, setDnsServersText] = useState<string>('https://dns.nextdns.io/bafda8/minlaxzemulator-ttrn');

    const value = useMemo<SetupConfigContextValue>(() => ({
        server,
        setServer,
        routingMode,
        setRoutingMode,
        localRoutingRulesText,
        setLocalRoutingRulesText,
        remoteRoutingURL,
        setRemoteRoutingURL,
        dnsServersText,
        setDnsServersText,
    }), [
        server,
        routingMode,
        localRoutingRulesText,
        remoteRoutingURL,
        dnsServersText,
    ]);

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
