import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useAppAlert } from '../components/AppAlert';
import ConnectControl from '../components/ConnectControl';
import { useAppToast } from '../components/AppToast';
import { useSetupProfile } from '../context/SetupProfileContext';
import { useTunnelSession } from '../context/TunnelSessionContext';
import { useLogs } from '../context/LogsContext';
import { effectiveRules, tunnelStartInput } from '../services/setupProfile';
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
  // No status caption (issue #61): the connect control carries the Display
  // State; only a recovery Session State keeps a persistent detail label.
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

  // Hidden only with no Profile List. An incomplete legacy Selected Profile
  // keeps the control; its only guard is the connect-refusal alert (#61) —
  // there is no Dashboard hint to explain a hidden control anymore.
  const fabVisible = isHydrated && profiles.length > 0;

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
      {recoveryDetail[state] ? (
        <Text style={styles.detailLabel}>{recoveryDetail[state]}</Text>
      ) : null}
      <View style={styles.controlsRow}>
        <View style={styles.hintArea}>
          {!isHydrated ? (
            <Text style={styles.hint}>Loading saved profile...</Text>
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
        <ConnectControl display={display} onPress={onFabPress} />
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, spacing, radius, typography, elevation } = theme;
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.lg,
      backgroundColor: colors.background,
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
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    hint: {
      ...typography.caption,
      marginTop: spacing.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.sm,
    },
    errorHint: {
      ...typography.caption,
      marginTop: spacing.xs,
      color: colors.danger,
      textAlign: 'center',
      paddingHorizontal: spacing.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    addButton: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonPrimary,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    profilesCard: {
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      ...elevation.level1,
    },
    profileRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    profileRowSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.background,
    },
    profileName: {
      ...typography.body,
      color: colors.textPrimary,
    },
    profileNameSelected: {
      fontWeight: '600',
    },
    sectionTitle: {
      ...typography.title,
      color: colors.textPrimary,
    },
  });
}
