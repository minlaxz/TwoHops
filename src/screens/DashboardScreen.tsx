import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import {
  ActivityIndicator,
  Pressable,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useAppAlert } from '../components/AppAlert';
import { useAppToast } from '../components/AppToast';
import { useSetupProfile } from '../context/SetupProfileContext';
import { useTunnelSession } from '../context/TunnelSessionContext';
import { useLogs } from '../context/LogsContext';
import {
  effectiveRules,
  missingFields,
  tunnelStartInput,
} from '../services/setupProfile';
import { displayState, type SessionState } from '../services/tunnelSession';
import type { AppTheme } from '../theme/colors';
import type { ProfileScreenParams } from './ProfileScreen';
import { useAppTheme } from '../context/ThemeContext';

type RootStackParamList = {
  Profile: ProfileScreenParams | undefined;
};

export default function DashboardScreen() {
  const {
    snapshot: { state, lastError },
    session,
  } = useTunnelSession();
  const { trafficLogs, debugLogs } = useLogs();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { profile, profiles, selectedId, selectProfile, isHydrated } =
    useSetupProfile();
  const alert = useAppAlert();
  const toast = useAppToast();

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

  const appendDebugLog = useCallback(
    (message: string) => debugLogs.append({ at: new Date(), message }),
    [debugLogs],
  );

  const handleConnect = () => {
    appendDebugLog('Connect button pressed.');

    const input = tunnelStartInput(profile);
    if (!input.ok) {
      const message = `Profile incomplete: ${input.error.missing.join(', ')}`;
      appendDebugLog(`Connect refused: ${message}`);
      alert('Connect refused', message);
      return;
    }
    // Logs are cleared on each connect command, never by recovery (CONTEXT.md).
    // A refused connect issues no command, so its refusal lines survive above.
    trafficLogs.clear();
    debugLogs.clear();
    appendDebugLog(`Setup config: ${setupSummary}`);
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
      toast('Stop the tunnel to switch profiles.');
      return;
    }
    if (id !== selectedId) {
      selectProfile(id);
      appendDebugLog('Selected Profile changed.');
    }
  };

  // Hidden with no Profile List or an incomplete Selected Profile (see #40).
  // Incompleteness only blocks starting — a Running/Busy tunnel keeps its
  // Stop control even if the profile is edited to incompleteness meanwhile.
  const fabVisible =
    isHydrated &&
    profiles.length > 0 &&
    (display !== 'stopped' || missing.length === 0);

  const onFabPress = () => {
    if (display === 'stopped') {
      handleConnect();
      return;
    }
    appendDebugLog('Stop button pressed.');
    session.disconnect();
  };

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
        <View style={styles.hintArea}>
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
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Profiles</Text>
          <Pressable
            testID="profile-add"
            accessibilityRole="button"
            accessibilityLabel="Add profile"
            style={styles.addButton}
            // Opens a blank Profile Draft (ADR 0005) — nothing is persisted
            // until the create screen commits it.
            onPress={() => navigation.navigate('Profile', { mode: 'create' })}
          >
            <Ionicons
              name="add"
              size={18}
              color={theme.colors.buttonPrimaryText}
            />
          </Pressable>
        </View>
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
              <View style={styles.rowRight}>
                <Pressable
                  testID={`profile-edit-${entry.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit profile ${entry.name}`}
                  hitSlop={8}
                  onPress={() =>
                    navigation.navigate('Profile', { profileId: entry.id })
                  }
                >
                  <Ionicons
                    name="pencil"
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
              </View>
            </Pressable>
          );
        })}
        {profiles.length === 0 && isHydrated ? (
          <Text style={styles.hint}>No profiles yet. Tap + to add one.</Text>
        ) : null}
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
            <Ionicons
              name={display === 'running' ? 'stop' : 'play'}
              size={24}
              color={theme.colors.buttonPrimaryText}
            />
          )}
        </Pressable>
      ) : null}
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
    hintArea: {
      flex: 1,
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
    errorHint: {
      marginTop: 4,
      fontSize: 12,
      color: theme.colors.danger,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    addButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.buttonPrimary,
      marginBottom: 12,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
      color: theme.colors.textPrimary,
    },
  });
}
