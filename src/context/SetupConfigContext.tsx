import React, { createContext, useContext, useMemo, useState } from 'react';
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

// const defaultServer: ServerConfig = {
//     name: 'lssg',
//     ipAddress: '13.251.208.16',
//     domain: 'trusted-1.minlaxz.lol',
//     login: 'minlaxz',
//     password: '000111222.@gG',
//     vpnProtocol: 'QUIC',
//     dnsServers: [],
// };
const defaultServer: ServerConfig = {
    name: '',
    ipAddress: '',
    domain: '',
    login: '',
    password: '',
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
    const [rulesText, setRulesText] = useState<string>('');
    const [dnsServersText, setDnsServersText] = useState<string>('');

    const value = useMemo<SetupConfigContextValue>(() => ({
        server,
        setServer,
        routingMode,
        setRoutingMode,
        rulesText,
        setRulesText,
        dnsServersText,
        setDnsServersText,
    }), [
        server,
        routingMode,
        rulesText,
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
