import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { TouchableOpacityButton } from '../components/buttons';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { useSetupProfile } from '../context/SetupProfileContext';
import { useTunnelSession } from '../context/TunnelSessionContext';
import {
  effectiveRules,
  missingFields,
  tunnelStartInput,
} from '../services/setupProfile';
import type { SessionState } from '../services/tunnelSession';
import type { AppTheme } from '../theme/colors';
import { useAppTheme } from '../context/ThemeContext';

type RootStackParamList = {
  Profile: undefined;
  Debug: undefined;
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

const smallButtonTouchableStyle = { width: '100%', height: 56 } as const;
const smallButtonTextStyle = { fontWeight: '600' as const, fontSize: 16 };

export default function DashboardScreen() {
  const {
    snapshot: { state },
    session,
  } = useTunnelSession();
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { profile, isHydrated } = useSetupProfile();

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const didLogSetupChangeRef = useRef(false);

  const setupSummary = useMemo(() => {
    const { server, routingMode, dnsServers } = profile;
    return `server=${server.ipAddress} domain=${server.domain} user=${
      server.login
    } protocol=${server.vpnProtocol}; dns=${
      dnsServers.join(', ') || '-'
    }; routeMode=${routingMode}; rules=${effectiveRules(profile).length};`;
  }, [profile]);

  const missing = missingFields(profile);

  const appendDebugLog = useCallback((message: string) => {
    setDebugLogs(prev =>
      [{ stamp: new Date(), message }, ...prev].slice(0, 200),
    );
  }, []);

  const handleConnect = () => {
    appendDebugLog('Connect button pressed.');
    appendDebugLog(`Setup config: ${setupSummary}`);

    const input = tunnelStartInput(profile);
    if (!input.ok) {
      const message = `Profile incomplete: ${input.error.missing.join(', ')}`;
      appendDebugLog(`Connect refused: ${message}`);
      Alert.alert('Connect refused', message);
      return;
    }
    session.connect(input.value);
  };

  const states: Record<SessionState, VpnUiStateDescriptor> = {
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
    disconnecting: {
      statusText: 'Disconnecting',
      statusEmoji: '⏳',
      switchValue: false,
      switchHint: 'Disconnecting...',
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

  const onSwitchValueChange = (nextValue: boolean) => {
    appendDebugLog(
      `Switch toggled to ${nextValue ? 'ON' : 'OFF'} while state=${state}.`,
    );
    if (nextValue) {
      handleConnect();
    } else {
      appendDebugLog('Disconnect button pressed.');
      session.disconnect();
    }
  };

  useEffect(() => {
    setDebugLogs([{ stamp: new Date(), message: 'Main screen ready.' }]);
    appendDebugLog(`Current state: ${session.getSnapshot().state}.`);
    return session.onDebug(entry => appendDebugLog(entry.message));
  }, [appendDebugLog, session]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!didLogSetupChangeRef.current) {
      didLogSetupChangeRef.current = true;
      appendDebugLog(`Setup loaded: ${setupSummary}`);
      return;
    }

    appendDebugLog(`Setup updated: ${setupSummary}`);
  }, [appendDebugLog, isHydrated, setupSummary]);

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
            title="Debug"
            onPress={() => navigation.navigate('Debug')}
          />
        </View>
        <View style={styles.rightButton}>
          {!isHydrated ? (
            <Text style={styles.switchHint}>Loading saved profile...</Text>
          ) : missing.length === 0 ? (
            <>
              <Switch
                trackColor={{
                  false: theme.colors.switchTrackFalse,
                  true: theme.colors.switchTrackTrue,
                }}
                thumbColor={
                  states[state].switchValue
                    ? theme.colors.switchThumbOn
                    : theme.colors.switchThumbOff
                }
                ios_backgroundColor={theme.colors.switchTrackFalse}
                onValueChange={onSwitchValueChange}
                value={states[state].switchValue}
                disabled={state !== 'disconnected' && state !== 'connected'}
              />
              <Text style={styles.switchEmoji}>
                {states[state].statusEmoji}
              </Text>
              <Text style={styles.switchHint}>{states[state].switchHint}</Text>
            </>
          ) : (
            <Text style={styles.switchHint}>
              Profile incomplete. Missing: {missing.join(', ')}. Open Profile to
              finish setup.
            </Text>
          )}
        </View>
      </View>
      <View style={styles.logsContainer}>
        <View style={styles.debugPanel}>
          <DebugLogsScreen logs={debugLogs} styles={styles} />
        </View>
      </View>
    </View>
  );
}

type DashboardStyles = ReturnType<typeof createStyles>;

type DebugLogsScreenProps = {
  logs: DebugLogEntry[];
  styles: DashboardStyles;
};

function DebugLogsScreen({ logs, styles }: DebugLogsScreenProps) {
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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 12,
      textAlign: 'center',
      color: theme.colors.textPrimary,
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
      color: theme.colors.textSecondary,
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
      minHeight: 180,
    },
    section: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
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
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
      color: theme.colors.textPrimary,
    },
    logEmpty: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    debugRow: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.logBorder,
    },
    logLine: {
      fontSize: 12,
      color: theme.colors.textPrimary,
    },
    logTime: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 6,
    },
  });
}
