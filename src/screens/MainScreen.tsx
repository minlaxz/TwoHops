import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { TouchableOpacityButton } from '../components/buttons';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { VpnClient, type RoutingConfig, type QueryLogRow, type ServerConfig, type VpnManagerState } from '../services';
import { splitList, fetchRemoteURL } from '../services/utils';
import { useSetupConfig } from '../context/SetupConfigContext';

type RootStackParamList = {
    Server: undefined;
    About: { name: string };
};

type State = {
    emoji: string;
    action: () => Promise<void>;
    actionText?: string;
}

type DebugLogEntry = {
    stamp: Date;
    message: string;
};

const smallButtonTouchableStyle = { width: "100%", height: 56 } as const;
const smallButtonTextStyle = { fontWeight: "600" as const, fontSize: 16 };
const connectButtonTouchableStyle = { height: 124, width: "100%" } as const;
const connectButtonTextStyle = { fontSize: 24, fontWeight: "700" as const };

export default function MainScreen() {
    const [state, setState] = useState<VpnManagerState>('disconnected');
    const [queryLogs, setQueryLogs] = useState<QueryLogRow[]>([]);
    const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);

    const {
        server,
        routingMode,
        localRoutingRulesText,
        remoteRoutingURL,
        dnsServersText,
    } = useSetupConfig();

    const navigation = useNavigation<NavigationProp<RootStackParamList>>();
    const didLogSetupChangeRef = useRef(false);

    const setupSummary = useMemo(() => {
        const dnsServers = splitList(dnsServersText);
        const localRules = splitList(localRoutingRulesText);

        return `server=${server.ipAddress} domain=${server.domain} user=${server.login} protocol=${server.vpnProtocol}; dns=${dnsServers.join(', ') || '-'}; routeMode=${routingMode}; localRules=${localRules.length}; remoteURL=${remoteRoutingURL || '-'};`;
    }, [dnsServersText, localRoutingRulesText, remoteRoutingURL, routingMode, server.domain, server.ipAddress, server.login, server.vpnProtocol]);

    const appendDebugLog = useCallback((message: string) => {
        setDebugLogs((prev) => [{ stamp: new Date(), message }, ...prev].slice(0, 200));
    }, []);

    const formatError = (error: unknown): string => {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    };

    const handleConnect = async () => {
        appendDebugLog('Connect button pressed.');
        appendDebugLog(`Setup config: ${setupSummary}`);
        setState('connecting');

        try {
            const localRules = splitList(localRoutingRulesText);
            let remoteRules: string[] = [];

            if (remoteRoutingURL) {
                appendDebugLog(`Fetching remote rules from ${remoteRoutingURL}.`);
                const remoteRoutingRulesText = await fetchRemoteURL(remoteRoutingURL);
                remoteRules = splitList(remoteRoutingRulesText);
                appendDebugLog(`Remote rules loaded (${remoteRules.length} entries).`);
            }

            const mergedRules = Array.from(new Set([...localRules, ...remoteRules]));
            const routing: RoutingConfig = {
                mode: routingMode,
                rules: mergedRules,
            };

            const updatedServer: ServerConfig = {
                ...server,
                dnsServers: splitList(dnsServersText),
            };

            await VpnClient.start({
                server: updatedServer, routing, excludedRoutes: []
            });
            appendDebugLog('Connect request sent to VPN client.');

            const currentState = await VpnClient.getCurrentState();
            setState(currentState);
            appendDebugLog(`State after connect: ${currentState}.`);
        } catch (error) {
            setState('disconnected');
            appendDebugLog(`Connect failed: ${formatError(error)}`);
        }
    };

    const handleDisconnect = async () => {
        appendDebugLog('Disconnect button pressed.');
        try {
            await VpnClient.stop();
            setQueryLogs([]);
            appendDebugLog('Disconnect request sent to VPN client.');

            const currentState = await VpnClient.getCurrentState();
            setState(currentState);
            appendDebugLog(`State after disconnect: ${currentState}.`);
        } catch (error) {
            appendDebugLog(`Disconnect failed: ${formatError(error)}`);
        }
    };

    const states: Record<VpnManagerState, State> = {
        "connected": { emoji: "🔗", action: handleDisconnect, actionText: "Disconnect" },
        "connecting": { emoji: "⏳", action: async () => { }, actionText: "Connecting..." },
        "disconnected": { emoji: "⛓️‍💥", action: handleConnect, actionText: "Connect" },
        "waitingForRecovery": { emoji: "🛟", action: async () => { } },
        "waitingForNetwork": { emoji: "📡", action: async () => { } },
        "recovering": { emoji: "🔄", action: async () => { } },
    };

    useEffect(() => {
        let active = true;

        setQueryLogs([]);
        setDebugLogs([
            { stamp: new Date(), message: 'Main screen ready.' },
        ]);

        VpnClient.getCurrentState().then((value) => {
            if (active) {
                setState(value);
                appendDebugLog(`Current state: ${value}.`);
            }
        }).catch((error) => {
            appendDebugLog(`Failed to read current state: ${formatError(error)}`);
        });

        const unsubscribeState = VpnClient.onState((value) => {
            setState(value);
            appendDebugLog(`State changed: ${value}.`);
        });

        const unsubscribeLog = VpnClient.onQueryLog((row) => {
            setQueryLogs((prev) => [row, ...prev].slice(0, 200));
        });

        return () => {
            active = false;
            unsubscribeState();
            unsubscribeLog();
        };
    }, [appendDebugLog]);

    useEffect(() => {
        if (!didLogSetupChangeRef.current) {
            didLogSetupChangeRef.current = true;
            appendDebugLog(`Setup loaded: ${setupSummary}`);
            return;
        }

        appendDebugLog(`Setup updated: ${setupSummary}`);
    }, [appendDebugLog, setupSummary]);

    const isBusy = state === "connecting" || state === "waitingForRecovery" || state === "waitingForNetwork" || state === "recovering";

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{states[state].emoji}</Text>
            <View style={styles.controlsRow}>
                <View style={styles.leftButtons}>
                    <TouchableOpacityButton
                        touchableOpacityStyles={smallButtonTouchableStyle}
                        title="Settings"
                        textStyles={smallButtonTextStyle}
                        onPress={() => navigation.navigate('Server')}
                    />
                    <View style={styles.leftButtonsSpacer} />
                    <TouchableOpacityButton
                        touchableOpacityStyles={smallButtonTouchableStyle}
                        textStyles={smallButtonTextStyle}
                        title="About"
                        onPress={() => navigation.navigate('About', { name: 'bar' })}
                    />
                </View>
                <View style={styles.rightButton}>
                    <TouchableOpacityButton
                        touchableOpacityStyles={connectButtonTouchableStyle}
                        textStyles={connectButtonTextStyle}
                        disabled={isBusy}
                        title={states[state].actionText || ""}
                        onPress={states[state].action}
                    />
                </View>
            </View>
            <View style={styles.logsContainer}>
                <View style={styles.debugPanel}>
                    <DebugLogsScreen logs={debugLogs} />
                </View>
                <View style={styles.trafficPanel}>
                    <TrafficLogsScreen logs={queryLogs} />
                </View>
            </View>
        </View>
    );
}


type DebugLogsScreenProps = {
    logs: DebugLogEntry[];
};

function DebugLogsScreen({ logs }: DebugLogsScreenProps) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Debug Logs</Text>
            <View style={styles.logScrollContainer}>
                <ScrollView
                    style={styles.logScroll}
                    contentContainerStyle={styles.logScrollContent}
                    showsVerticalScrollIndicator
                >
                    {logs.length === 0 ? <Text style={styles.logEmpty}>No debug logs yet.</Text> : null}
                    {logs.map((log, index) => (
                        <View style={styles.debugRow} key={`${log.stamp.toISOString()}-${index}`}>
                            <Text style={styles.logLine}>{log.message}</Text>
                            <Text style={styles.logTime}>{log.stamp.toISOString()}</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
}

type TrafficLogsScreenProps = {
    logs: QueryLogRow[];
};

function TrafficLogsScreen({ logs }: TrafficLogsScreenProps) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Traffic Logs</Text>
            <View style={styles.logScrollContainer}>
                <ScrollView
                    style={styles.logScroll}
                    contentContainerStyle={styles.logScrollContent}
                    showsVerticalScrollIndicator
                >
                    {logs.length === 0 ? <Text style={styles.logEmpty}>No traffic logs yet.</Text> : null}
                    {logs.map((log, index) => (
                        <View style={styles.debugRow} key={`${log.stamp.toISOString()}-${log.source}-${index}`}>
                            <Text style={styles.logTitle}>{log.action.toUpperCase()} {log.protocol.toUpperCase()} Domain: {log.domain ?? '-'}</Text>
                            <Text style={styles.logLine}>{log.source} → {log.destination ?? 'unknown'}</Text>
                            <Text style={styles.logTime}>{log.stamp.toISOString()}</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f0f0f0' },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    leftButtons: {
        flex: 1,
    },
    leftButtonsSpacer: {
        height: 12,
    },
    rightButton: {
        flex: 1.2,
        marginLeft: 12,
    },
    logsContainer: {
        flex: 1,
        marginTop: 14,
        minHeight: 320,
    },
    debugPanel: {
        flex: 1,
        minHeight: 120,
        marginBottom: 12,
    },
    trafficPanel: {
        flex: 2,
        minHeight: 180,
    },
    section: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#ffffff',
    },
    logScrollContainer: {
        flex: 1,
    },
    logScroll: {
        flex: 1,
    },
    logScrollContent: {
        paddingBottom: 8,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
    logEmpty: {
        fontSize: 14,
        color: '#666',
    },
    debugRow: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ececec',
    },
    logRow: {
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#d9d9d9',
        marginBottom: 10,
        backgroundColor: '#fff',
    },
    logTitle: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 4,
    },
    logLine: {
        fontSize: 12,
        color: '#333',
    },
    logTime: {
        fontSize: 11,
        color: '#666',
        marginTop: 6,
    },
});
