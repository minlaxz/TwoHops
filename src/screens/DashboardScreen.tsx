import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { View, Text, StyleSheet, Share } from 'react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import PressableScale from '../components/PressableScale';
import AddProfileSheet from '../components/AddProfileSheet';
import ProfilePickerSheet from '../components/ProfilePickerSheet';
import { useAppAlert } from '../components/AppAlert';
import ConnectControl from '../components/ConnectControl';
import { useAppToast } from '../components/AppToast';
import { useSetupProfile } from '../context/SetupProfileContext';
import { useTunnelSession } from '../context/TunnelSessionContext';
import { useLogs } from '../context/LogsContext';
import { trigger as hapticTick } from 'react-native-haptic-feedback';
import {
  effectiveRules,
  profileLink,
  profileSubtitle,
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
  const addSheetRef = useRef<BottomSheetModal>(null);
  const pickerRef = useRef<BottomSheetModal>(null);

  const setupSummary = useMemo(() => {
    const { server, routingMode, dnsServers, bypassDnsServers } = profile;
    return `server=${server.ipAddress} domain=${server.domain} user=${
      server.login
    } protocol=${server.vpnProtocol}; dns=${
      dnsServers.join(', ') || '-'
    }; bypassDns=${
      bypassDnsServers.join(', ') || '-'
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
    // Haptic tick only when a command is actually issued (#79).
    hapticTick('impactLight');
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

  const handleOpenPicker = () => {
    // Recovery states collapse to Running; Busy is locked too — honest either way.
    if (display !== 'stopped') {
      appendDebugLog('Profile switch refused: tunnel is not stopped.');
      toast('Stop the tunnel to switch profiles.');
      return;
    }
    pickerRef.current?.present();
  };

  const handleSelectProfile = (id: string) => {
    if (id !== selectedId) {
      selectProfile(id);
      appendDebugLog('Selected Profile changed.');
    }
  };

  const selected = profiles.find(entry => entry.id === selectedId) ?? null;

  // Edit (#105): same lock as the Picker. Rendered dimmed, still tappable,
  // so the refusal can explain itself. Share is never locked.
  const editLocked = display !== 'stopped';
  const handleEdit = () => {
    if (editLocked) {
      appendDebugLog('Profile edit refused: tunnel is not stopped.');
      toast('Stop the tunnel to edit the profile.');
      return;
    }
    if (selected) {
      navigation.navigate('Profile', { profileId: selected.id });
    }
  };

  // Share Profile (#90): link only, no title; the OS sheet is the feedback.
  // The link carries the password, so the Debug Log never echoes it.
  const handleShare = () => {
    Share.share({ message: profileLink(profile) }).then(
      () => appendDebugLog('Profile Link shared.'),
      (error: unknown) =>
        appendDebugLog(
          `Share failed: ${error instanceof Error ? error.message : error}`,
        ),
    );
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
    hapticTick('impactLight');
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
          <PressableScale
            testID="profile-add"
            accessibilityRole="button"
            accessibilityLabel="Add profile"
            style={styles.addButton}
            onPress={() => addSheetRef.current?.present()}
          >
            <Ionicons
              name="add"
              size={18}
              color={theme.colors.buttonPrimaryText}
            />
          </PressableScale>
        </View>
        {profiles.length === 0 && isHydrated ? (
          <Text style={styles.hint}>No profiles yet. Tap + to add one.</Text>
        ) : null}
        {profiles.length > 0 ? (
          <PressableScale
            testID="profile-selected"
            accessibilityRole="button"
            style={[styles.profileRow, selected && styles.profileRowSelected]}
            onPress={handleOpenPicker}
          >
            <View style={styles.profileText}>
              <Text
                style={[
                  styles.profileName,
                  selected && styles.profileNameSelected,
                ]}
                numberOfLines={1}
              >
                {selected ? selected.name : 'Choose a profile'}
              </Text>
              {selected ? (
                <Text style={styles.profileSubtitle} numberOfLines={1}>
                  {profileSubtitle(selected)}
                </Text>
              ) : null}
            </View>
            <Ionicons
              name="chevron-down"
              size={18}
              color={theme.colors.textSecondary}
            />
          </PressableScale>
        ) : null}
        {selected ? (
          <View style={styles.actions}>
            <PressableScale
              testID="profile-edit"
              accessibilityRole="button"
              accessibilityLabel={`Edit profile ${selected.name}`}
              style={[styles.action, editLocked && styles.actionDimmed]}
              onPress={handleEdit}
            >
              <Ionicons
                name="pencil"
                size={16}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.actionLabel}>Edit</Text>
            </PressableScale>
            <View style={styles.actionDivider} />
            <PressableScale
              testID="profile-share"
              accessibilityRole="button"
              accessibilityLabel={`Share profile ${selected.name}`}
              style={styles.action}
              onPress={handleShare}
            >
              <Ionicons
                name="share-outline"
                size={16}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.actionLabel}>Share</Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
      {fabVisible ? (
        <ConnectControl display={display} onPress={onFabPress} />
      ) : null}
      {/* Both routes open a blank Profile Draft (ADR 0005) — nothing is
          persisted until the create screen commits it. Paste lands on the
          link input with the keyboard up. */}
      <ProfilePickerSheet
        sheetRef={pickerRef}
        profiles={profiles}
        selectedId={selectedId}
        onSelect={handleSelectProfile}
      />
      <AddProfileSheet
        sheetRef={addSheetRef}
        onNewProfile={() => navigation.navigate('Profile', { mode: 'create' })}
        onPasteLink={() =>
          navigation.navigate('Profile', { mode: 'create', focus: 'link' })
        }
      />
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, spacing, radius, typography, card } = theme;
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
    profilesCard: {
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.md,
      ...card,
    },
    profileRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      // Reserves the highlight's border so the row keeps one size either way.
      borderWidth: 1,
      borderColor: 'transparent',
    },
    profileRowSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.background,
    },
    profileText: {
      flex: 1,
    },
    profileName: {
      ...typography.body,
      color: colors.textPrimary,
    },
    profileNameSelected: {
      fontWeight: '600',
      color: colors.accent,
    },
    profileSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    action: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    actionDimmed: {
      opacity: 0.4,
    },
    actionDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    actionLabel: {
      ...typography.body,
      color: colors.textSecondary,
    },
    sectionTitle: {
      ...typography.title,
      color: colors.textPrimary,
    },
  });
}
