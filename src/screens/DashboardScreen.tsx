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
  ActivityIndicator,
  Alert,
  Pressable,
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSetupProfile } from '../context/SetupProfileContext';
import { useTunnelSession } from '../context/TunnelSessionContext';
import {
  effectiveRules,
  missingFields,
  tunnelStartInput,
} from '../services/setupProfile';
import { displayState, type SessionState } from '../services/tunnelSession';
import type { AppTheme } from '../theme/colors';
import { useAppTheme } from '../context/ThemeContext';

type RootStackParamList = {
  Profile: undefined;
};

type DebugLogEntry = {
  stamp: Date;
  message: string;
};

const smallButtonTouchableStyle = { width: '100%', height: 56 } as const;
const smallButtonTextStyle = { fontWeight: '600' as const, fontSize: 16 };

export default function DashboardScreen() {
  const {
    snapshot: { state, lastError },
    session,
  } = useTunnelSession();
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { profile, profiles, selectedId, selectProfile, isHydrated } =
    useSetupProfile();
  // ponytail: inline transient notice as the "toast"; RN has no cross-platform
  // toast and this is the only caller — extract if a second one shows up
  const [switchLockNotice, setSwitchLockNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    },
    [],
  );

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

  const display = displayState(state);
  const displayTitle = { stopped: 'Stopped', busy: 'Busy', running: 'Running' }[
    display
  ];
  // Recovery states collapse to Running; the detail label carries the nuance.
  const recoveryDetail: Partial<Record<SessionState, string>> = {
    waitingForRecovery: 'Reconnecting…',
    recovering: 'Reconnecting…',
    waitingForNetwork: 'Waiting for network…',
  };

  const handleSelectProfile = (id: string) => {
    // Recovery states collapse to Running; Busy is locked too — honest either way.
    if (display !== 'stopped') {
      appendDebugLog('Profile switch refused: tunnel is not stopped.');
      setSwitchLockNotice('Stop the tunnel to switch profiles.');
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
      noticeTimer.current = setTimeout(() => setSwitchLockNotice(null), 2500);
      return;
    }
    if (id !== selectedId) {
      selectProfile(id);
      appendDebugLog('Selected Profile changed.');
    }
  };

  // Hidden with no Profile List or an incomplete Selected Profile (see #40).
  const fabVisible = isHydrated && profiles.length > 0 && missing.length === 0;

  const onFabPress = () => {
    if (display === 'stopped') {
      handleConnect();
      return;
    }
    appendDebugLog('Stop button pressed.');
    session.disconnect();
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
      <Text style={styles.title}>{displayTitle}</Text>
      {recoveryDetail[state] ? (
        <Text style={styles.detailLabel}>{recoveryDetail[state]}</Text>
      ) : null}
      <View style={styles.controlsRow}>
        <View style={styles.leftButtons}>
          <TouchableOpacityButton
            touchableOpacityStyles={smallButtonTouchableStyle}
            title="Profile"
            textStyles={smallButtonTextStyle}
            onPress={() => navigation.navigate('Profile')}
          />
        </View>
        <View style={styles.rightButton}>
          {!isHydrated ? (
            <Text style={styles.hint}>Loading saved profile...</Text>
          ) : profiles.length > 0 && missing.length > 0 ? (
            <Text style={styles.hint}>
              Profile incomplete. Missing: {missing.join(', ')}. Open Profile to
              finish setup.
            </Text>
          ) : lastError ? (
            <Text style={styles.errorHint}>{lastError.message}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.profilesCard}>
        <Text style={styles.sectionTitle}>Profiles</Text>
        {profiles.map(entry => {
          const isSelected = entry.id === selectedId;
          return (
            <Pressable
              key={entry.id}
              testID={`profile-row-${entry.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.profileRow,
                isSelected && styles.profileRowSelected,
              ]}
              onPress={() => handleSelectProfile(entry.id)}
            >
              <Text
                style={[
                  styles.profileName,
                  isSelected && styles.profileNameSelected,
                ]}
              >
                {entry.name}
              </Text>
              {isSelected ? <Text style={styles.profileName}>✓</Text> : null}
            </Pressable>
          );
        })}
        {profiles.length === 0 && isHydrated ? (
          <Text style={styles.hint}>
            No profiles yet. Open Profile to create one.
          </Text>
        ) : null}
        {switchLockNotice ? (
          <Text style={styles.errorHint}>{switchLockNotice}</Text>
        ) : null}
      </View>
      <View style={styles.logsContainer}>
        <View style={styles.debugPanel}>
          <DebugLogsScreen logs={debugLogs} styles={styles} />
        </View>
      </View>
      {fabVisible ? (
        <Pressable
          testID="fab"
          accessibilityRole="button"
          accessibilityLabel={
            display === 'stopped'
              ? 'Start tunnel'
              : display === 'busy'
              ? 'Tunnel busy'
              : 'Stop tunnel'
          }
          accessibilityState={{ disabled: display === 'busy' }}
          disabled={display === 'busy'}
          onPress={onFabPress}
          style={styles.fab}
        >
          {display === 'busy' ? (
            <ActivityIndicator color={theme.colors.buttonPrimaryText} />
          ) : (
            <Text style={styles.fabGlyph}>
              {display === 'running' ? '■' : '▶'}
            </Text>
          )}
        </Pressable>
      ) : null}
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
    rightButton: {
      flex: 1.2,
      marginLeft: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: -8,
      marginBottom: 12,
    },
    hint: {
      marginTop: 6,
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    fab: {
      position: 'absolute',
      right: 24,
      bottom: 24,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.buttonPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    fabGlyph: {
      fontSize: 24,
      color: theme.colors.buttonPrimaryText,
    },
    errorHint: {
      marginTop: 4,
      fontSize: 12,
      color: theme.colors.danger,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    profilesCard: {
      marginTop: 14,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    profileRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    profileRowSelected: {
      borderColor: theme.colors.buttonPrimary,
      backgroundColor: theme.colors.background,
    },
    profileName: {
      fontSize: 14,
      color: theme.colors.textPrimary,
    },
    profileNameSelected: {
      fontWeight: '600',
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
