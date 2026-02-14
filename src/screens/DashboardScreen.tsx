import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { TouchableOpacityButton } from '../components/buttons';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { VpnClient } from '../services/vpn';
import { splitList } from '../services/utils';
import { useSetupConfig } from '../context/SetupConfigContext';
import type {
  RoutingConfig,
  QueryLogRow,
  VpnManagerState,
  ServerConfig,
} from '../types';

type RootStackParamList = {
  Profile: undefined;
  Migrate: { url: string };
};

type DebugLogEntry = {
  stamp: Date;
  message: string;
};

type VpnUiStateDescriptor = {
  statusText: string;
  statusEmoji: string;
  switchValue: boolean;
  switchHint: string;
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

const smallButtonTouchableStyle = { width: '100%', height: 56 } as const;
const smallButtonTextStyle = { fontWeight: '600' as const, fontSize: 16 };

export default function DashboardScreen() {
  const [state, setState] = useState<VpnManagerState>('disconnected');
  const [queryLogs, setQueryLogs] = useState<QueryLogRow[]>([]);
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [isSwitchActionInFlight, setIsSwitchActionInFlight] = useState(false);

  const { server, routingMode, rulesText, dnsServersText } = useSetupConfig();

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const didLogSetupChangeRef = useRef(false);
  const switchActionInFlightRef = useRef(false);

  const setupSummary = useMemo(() => {
    const dnsServers = splitList(dnsServersText);
    const rules = splitList(rulesText);

    return `server=${server.ipAddress} domain=${server.domain} user=${server.login
      } protocol=${server.vpnProtocol}; dns=${dnsServers.join(', ') || '-'
      }; routeMode=${routingMode}; rules=${rules.length};`;
  }, [
    dnsServersText,
    rulesText,
    routingMode,
    server.domain,
    server.ipAddress,
    server.login,
    server.vpnProtocol,
  ]);

  const appendDebugLog = useCallback((message: string) => {
    setDebugLogs(prev =>
      [{ stamp: new Date(), message }, ...prev].slice(0, 200),
    );
  }, []);

  const formatError = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  };

  const syncStateWithNative = useCallback(
    async (reason: string) => {
      const probeDelays = [300, 900, 1800];

      for (const probeDelay of probeDelays) {
        await delay(probeDelay);
        try {
          const nativeState = await VpnClient.getCurrentState();
          setState(nativeState);
          appendDebugLog(`State probe (${reason}): ${nativeState}.`);

          if (nativeState === 'connected' || nativeState === 'disconnected') {
            break;
          }
        } catch (error) {
          appendDebugLog(
            `State probe failed (${reason}): ${formatError(error)}`,
          );
          break;
        }
      }
    },
    [appendDebugLog],
  );

  const handleConnect = async () => {
    appendDebugLog('Connect button pressed.');
    appendDebugLog(`Setup config: ${setupSummary}`);
    setState('connecting');

    try {
      const routing: RoutingConfig = {
        mode: routingMode,
        rules: splitList(rulesText),
      };

      const updatedServer: ServerConfig = {
        ...server,
        dnsServers: splitList(dnsServersText),
      };

      await VpnClient.start({
        server: updatedServer,
        routing,
        excludedRoutes: [],
      });
      appendDebugLog('Connect request sent to VPN client.');
      syncStateWithNative('after connect').catch(error => {
        appendDebugLog(
          `State sync failed after connect: ${formatError(error)}`,
        );
      });
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
      syncStateWithNative('after disconnect').catch(error => {
        appendDebugLog(
          `State sync failed after disconnect: ${formatError(error)}`,
        );
      });
    } catch (error) {
      appendDebugLog(`Disconnect failed: ${formatError(error)}`);
    }
  };

  const states: Record<VpnManagerState, VpnUiStateDescriptor> = {
    connected: {
      statusText: 'Connected',
      statusEmoji: '🔗',
      switchValue: true,
      switchHint: 'Turn off to disconnect',
    },
    connecting: {
      statusText: 'Connecting',
      statusEmoji: '⏳',
      switchValue: true,
      switchHint: 'Connecting in progress...',
    },
    disconnected: {
      statusText: 'Disconnected',
      statusEmoji: '⛓️‍💥',
      switchValue: false,
      switchHint: 'Turn on to connect',
    },
    waitingForRecovery: {
      statusText: 'Waiting for Recovery',
      statusEmoji: '🛟',
      switchValue: true,
      switchHint: 'Waiting for tunnel recovery...',
    },
    waitingForNetwork: {
      statusText: 'Waiting for Network',
      statusEmoji: '📡',
      switchValue: true,
      switchHint: 'Waiting for network connectivity...',
    },
    recovering: {
      statusEmoji: '🔄',
      statusText: 'Recovering',
      switchValue: true,
      switchHint: 'Recovering tunnel state...',
    },
  };

  const handleSwitchChange = async (nextValue: boolean) => {
    if (switchActionInFlightRef.current) {
      appendDebugLog(
        'Ignored switch toggle: previous action still in progress.',
      );
      return;
    }

    switchActionInFlightRef.current = true;
    setIsSwitchActionInFlight(true);
    appendDebugLog(
      `Switch toggled to ${nextValue ? 'ON' : 'OFF'} while state=${state}.`,
    );

    try {
      if (nextValue) {
        if (state === 'disconnected') {
          await handleConnect();
        } else {
          appendDebugLog(
            `Ignored ON toggle because VPN state is already ${state}.`,
          );
        }
        return;
      }

      if (state === 'disconnected') {
        appendDebugLog(
          'Ignored OFF toggle because VPN is already disconnected.',
        );
        return;
      }

      await handleDisconnect();
    } finally {
      switchActionInFlightRef.current = false;
      setIsSwitchActionInFlight(false);
    }
  };

  const onSwitchValueChange = (value: boolean) => {
    handleSwitchChange(value).catch(error => {
      appendDebugLog(`Switch action failed: ${formatError(error)}`);
    });
  };

  useEffect(() => {
    let active = true;

    setQueryLogs([]);
    setDebugLogs([{ stamp: new Date(), message: 'Main screen ready.' }]);

    VpnClient.getCurrentState()
      .then(value => {
        if (active) {
          setState(value);
          appendDebugLog(`Current state: ${value}.`);
        }
      })
      .catch(error => {
        appendDebugLog(`Failed to read current state: ${formatError(error)}`);
      });

    const unsubscribeState = VpnClient.onState(value => {
      setState(value);
      appendDebugLog(`State changed: ${value}.`);
    });

    const unsubscribeLog = VpnClient.onQueryLog(row => {
      setQueryLogs(prev => [row, ...prev].slice(0, 200));
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{states[state].statusText}</Text>
      <View style={styles.controlsRow}>
        <View style={styles.leftButtons}>
          <TouchableOpacityButton
            touchableOpacityStyles={smallButtonTouchableStyle}
            title="Profile"
            textStyles={smallButtonTextStyle}
            onPress={() => navigation.navigate('Profile')}
          />
          <View style={styles.leftButtonsSpacer} />
          <TouchableOpacityButton
            touchableOpacityStyles={smallButtonTouchableStyle}
            textStyles={smallButtonTextStyle}
            title="Migrate"
            onPress={() => navigation.navigate('Migrate', { url: 'https://example.com' })}
          />
        </View>
        <View style={styles.rightButton}>
          <Switch
            trackColor={{ false: '#767577', true: '#31425e' }}
            thumbColor={states[state].switchValue ? '#000000' : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
            onValueChange={onSwitchValueChange}
            value={states[state].switchValue}
            disabled={isSwitchActionInFlight || server.ipAddress === '' || server.login === '' || server.password === '' || server.domain === ''}
          />
          <Text style={styles.switchEmoji}>{states[state].statusEmoji}</Text>
          <Text style={styles.switchHint}>{states[state].switchHint}</Text>
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
          {logs.length === 0 ? (
            <Text style={styles.logEmpty}>No debug logs yet.</Text>
          ) : null}
          {logs.map((log, index) => (
            <View
              style={styles.debugRow}
              key={`${log.stamp.toISOString()}-${index}`}
            >
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

function toWildcardDomain(domain: string): string {
  const parts = domain.split('.');

  if (parts.length <= 2) {
    // example.com → *.example.com
    return `*.${domain}`;
  }
  // Or take last two parts
  const baseDomain = parts.slice(-2).join('.');
  return `*.${baseDomain}`;
}

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
          {logs.length === 0 ? (
            <Text style={styles.logEmpty}>No traffic logs yet.</Text>
          ) : null}
          {logs.map((log, index) => (
            <View
              style={styles.debugRow}
              key={`${log.stamp.toISOString()}-${log.source}-${index}`}
            >
              <Text style={styles.logTitle}>
                {log.action.toUpperCase()} {log.protocol.toUpperCase()} Domain:{' '}
                {toWildcardDomain(log.domain ?? '-')}
              </Text>
              <Text style={styles.logLine}>
                {log.source} → {log.destination ?? 'unknown'}
              </Text>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchEmoji: {
    marginTop: 8,
    fontSize: 20,
  },
  switchHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
    paddingHorizontal: 8,
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
