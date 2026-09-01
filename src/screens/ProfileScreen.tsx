import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, StyleSheet, View, TextInput } from 'react-native';
import {
  useNavigation,
  usePreventRemove,
  useRoute,
} from '@react-navigation/native';
import Config from 'react-native-config';
import MainScreen from '../components/views';
import { TouchableOpacityButton } from '../components/buttons';
import { useAppAlert } from '../components/AppAlert';
import { useAppToast } from '../components/AppToast';
import { useSetupProfile } from '../context/SetupProfileContext';
import { useTunnelSession } from '../context/TunnelSessionContext';
import { parseRules } from '../services/routingRules';
import {
  applyProfileLink,
  defaultProfile,
  effectiveRules,
  importRemoteRules,
  missingFields,
  profileLinkErrorMessage,
  updateProfile as updateProfileIntent,
  updateServer as updateServerIntent,
  type ProfileEnv,
  type SetupProfile,
} from '../services/setupProfile';
import { displayState } from '../services/tunnelSession';
import { useAppTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme/colors';

// Shared with DashboardScreen's RootStackParamList so the two cannot drift.
export type ProfileScreenParams = { profileId?: string; mode?: 'create' };

export default function ServerScreen() {
  const { profiles, selectedId, createProfile, saveProfile, deleteProfile } =
    useSetupProfile();
  const {
    snapshot: { state },
  } = useTunnelSession();
  const navigation = useNavigation();
  const route = useRoute();
  const alert = useAppAlert();
  const toast = useAppToast();
  // Edit is addressed by id (pencil); Add passes `mode: 'create'` and the
  // screen edits a Profile Draft instead of a Profile List entry (ADR 0005).
  const params = route.params as ProfileScreenParams | undefined;
  const isCreateMode = params?.mode === 'create';
  const entry = profiles.find(candidate => candidate.id === params?.profileId);
  const [url, setURL] = useState<string>('');
  // Create mode collapses Advanced (the link is the expected path); edit
  // mode opens it (the fields are what the pencil came for).
  const [advancedOpen, setAdvancedOpen] = useState(!isCreateMode);
  // The Profile Draft: in-memory until Create (blank) or Save (loaded from
  // the entry) commits it. A create draft's name starts blank — no generated
  // "Profile n". Edit mode never writes through; the entry is only a seed.
  const [draft, setDraft] = useState<{ name: string; profile: SetupProfile }>(
    () =>
      entry && !isCreateMode
        ? { name: entry.name, profile: entry }
        : { name: '', profile: defaultProfile(Config as ProfileEnv) },
  );
  const [isTouched, setIsTouched] = useState(false);
  const committedRef = useRef(false);

  const profile = isCreateMode || entry ? draft.profile : undefined;
  const profileName = draft.name;

  // DNS text is only a display of the DNS Servers list; local state keeps
  // the user's in-progress punctuation while the list is the source of truth.
  const dnsList = (profile?.dnsServers ?? []).join(',');
  const [dnsText, setDnsText] = useState(dnsList);
  useEffect(() => {
    setDnsText(prev =>
      parseRules(prev).join(',') === dnsList ? prev : dnsList,
    );
  }, [dnsList]);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const placeholderTextColor = theme.colors.placeholder;

  // Header back and Android hardware back both funnel through here: a
  // touched Draft asks before discarding; a committed one passes through.
  usePreventRemove(isTouched, ({ data }) => {
    if (committedRef.current) {
      navigation.dispatch(data.action);
      return;
    }
    alert('Discard changes?', 'Your changes will not be saved.', [
      { text: 'Keep Editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  // Deleted underneath us, or opened with nothing to edit.
  if (!profile) {
    return (
      <MainScreen>
        <Text style={styles.title}>Configurations</Text>
        <Text style={styles.inputDescription}>
          No profile to edit. Use + on the Dashboard to add one.
        </Text>
      </MainScreen>
    );
  }

  const { server, routingMode, localRulesText, remoteRulesURL, importedAt } =
    profile;
  const display = displayState(state);
  // Every Draft edit marks it touched — the discard confirmation and the
  // Save gate both key off this flag (touched semantics, not value-diff).
  const patchDraft = (transform: (prev: typeof draft) => typeof draft) => {
    setDraft(transform);
    setIsTouched(true);
  };
  const updateProfile = (patch: Parameters<typeof updateProfileIntent>[1]) =>
    patchDraft(prev => ({
      ...prev,
      profile: updateProfileIntent(prev.profile, patch),
    }));
  const updateServer = (patch: Parameters<typeof updateServerIntent>[1]) =>
    patchDraft(prev => ({
      ...prev,
      profile: updateServerIntent(prev.profile, patch),
    }));
  const setProfileName = (value: string) =>
    patchDraft(prev => ({ ...prev, name: value }));

  // The Completeness gate: Create/Save can never mint an incomplete profile.
  // Save is additionally gated on the touched flag (issue #71): an untouched
  // edit draft has nothing to save, however complete it is.
  const canCommit =
    missingFields(profile).length === 0 && (isCreateMode || isTouched);
  const handleCommit = () => {
    if (committedRef.current) {
      return; // a second tap before the pop lands must not commit twice
    }
    committedRef.current = true;
    if (isCreateMode) {
      createProfile(draft.name, draft.profile);
    } else if (entry) {
      saveProfile(entry.id, draft.name, draft.profile);
      // The live tunnel keeps its config; only the next connect reads this.
      if (entry.id === selectedId && display !== 'stopped') {
        toast('Changes apply on next connect');
      }
    }
    navigation.goBack();
  };

  const handleDelete = () => {
    if (!entry) {
      return;
    }
    if (entry.id === selectedId && display !== 'stopped') {
      alert('Cannot delete', 'Stop the tunnel to delete the Selected Profile.');
      return;
    }
    alert(
      `Delete "${entry.name}"?`,
      'This removes the profile and its saved credentials from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // A touched draft is moot once its entry is gone — let the pop
            // through instead of raising the discard confirmation.
            committedRef.current = true;
            setIsTouched(false);
            deleteProfile(entry.id);
            navigation.goBack();
          },
        },
      ],
    );
  };

  return (
    <MainScreen>
      <Text style={styles.title}>Configurations</Text>
      <View style={styles.section}>
        {isCreateMode ? (
          <>
            <TextInput
              testID="profile-link-input"
              style={styles.input}
              placeholder="twohops://..."
              placeholderTextColor={placeholderTextColor}
              value={url}
              onChangeText={setURL}
              autoCapitalize="none"
            />
            <Text style={styles.inputDescription}>
              Paste a Profile Link to fill this profile's details in
              automatically.
            </Text>
            <TouchableOpacityButton
              touchableOpacityStyles={[
                styles.modeButton,
                styles.modeButtonWide,
              ]}
              textStyles={styles.modeButtonText}
              title="Apply Link"
              testID="profile-link-apply"
              onPress={() => {
                // ADR 0005: the link patches the Profile Draft in place —
                // nothing reaches the Profile List until Create.
                const result = applyProfileLink(profile, url);
                if (!result.ok) {
                  alert(
                    'Profile Link failed',
                    profileLinkErrorMessage(result.error),
                  );
                  return;
                }
                patchDraft(prev => ({ ...prev, profile: result.value }));
                setURL('');
                setAdvancedOpen(true);
              }}
            />
            <View style={styles.line} />
          </>
        ) : null}
        <Pressable
          testID="profile-advanced-toggle"
          accessibilityRole="button"
          accessibilityState={{ expanded: advancedOpen }}
          style={styles.advancedHeader}
          onPress={() => setAdvancedOpen(open => !open)}
        >
          <Text style={styles.sectionTitle}>Advanced</Text>
          <Text style={styles.advancedChevron}>{advancedOpen ? '▾' : '▸'}</Text>
        </Pressable>
        {advancedOpen ? (
          <>
            <Text style={styles.inputLabel}>Profile name:</Text>
            <TextInput
              testID="profile-name-input"
              style={styles.input}
              placeholder="Profile name"
              placeholderTextColor={placeholderTextColor}
              value={profileName}
              onChangeText={setProfileName}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={placeholderTextColor}
              value={server.name}
              onChangeText={value => updateServer({ name: value })}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Server IP Address"
              placeholderTextColor={placeholderTextColor}
              value={server.ipAddress}
              onChangeText={value => updateServer({ ipAddress: value })}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="TLS Domain Name"
              placeholderTextColor={placeholderTextColor}
              value={server.domain}
              onChangeText={value => updateServer({ domain: value })}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={placeholderTextColor}
              value={server.login}
              onChangeText={value => updateServer({ login: value })}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Password"
              placeholderTextColor={placeholderTextColor}
              value={server.password}
              onChangeText={value => updateServer({ password: value })}
              secureTextEntry
            />
            <Text style={styles.inputLabel}>DNS Servers:</Text>
            <TextInput
              style={styles.input}
              placeholder="DNS Servers (comma-separated)"
              placeholderTextColor={placeholderTextColor}
              value={dnsText}
              onChangeText={value => {
                setDnsText(value);
                updateProfile({ dnsServers: parseRules(value) });
              }}
              autoCapitalize="none"
            />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>
                Mode: {server.vpnProtocol.toLowerCase()}
              </Text>
              <View style={styles.rowButtons}>
                <TouchableOpacityButton
                  touchableOpacityStyles={[
                    styles.protocolButton,
                    server.vpnProtocol === 'Http/2'
                      ? styles.modeButtonActive
                      : styles.modeButtonInactive,
                  ]}
                  textStyles={styles.modeButtonText}
                  title="Http/2"
                  onPress={() => updateServer({ vpnProtocol: 'Http/2' })}
                />
                <View style={styles.rowSpacer} />
                <TouchableOpacityButton
                  touchableOpacityStyles={[
                    styles.protocolButton,
                    server.vpnProtocol === 'QUIC'
                      ? styles.modeButtonActive
                      : styles.modeButtonInactive,
                  ]}
                  textStyles={styles.modeButtonText}
                  title="QUIC"
                  onPress={() => updateServer({ vpnProtocol: 'QUIC' })}
                />
              </View>
            </View>
            <Text style={styles.sectionTitle}>Routing</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Mode: {routingMode}</Text>
              <View style={styles.rowButtons}>
                <TouchableOpacityButton
                  touchableOpacityStyles={[
                    styles.modeButton,
                    routingMode === 'general'
                      ? styles.modeButtonActive
                      : styles.modeButtonInactive,
                  ]}
                  textStyles={styles.modeButtonText}
                  title="General"
                  onPress={() => updateProfile({ routingMode: 'general' })}
                />
                <View style={styles.rowSpacer} />
                <TouchableOpacityButton
                  touchableOpacityStyles={[
                    styles.modeButton,
                    styles.modeButtonWide,
                    routingMode === 'selective'
                      ? styles.modeButtonActive
                      : styles.modeButtonInactive,
                  ]}
                  textStyles={styles.modeButtonText}
                  title="Selective"
                  onPress={() => updateProfile({ routingMode: 'selective' })}
                />
              </View>
            </View>
            <Text style={styles.inputDescription}>
              In most cases, "Selective" mode is recommended for better
              performance and battery life.
            </Text>
            <View style={styles.line} />
            <Text style={styles.inputLabel}>Remote Rules URL:</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor={placeholderTextColor}
              value={remoteRulesURL}
              onChangeText={value => updateProfile({ remoteRulesURL: value })}
              autoCapitalize="none"
            />
            <Text style={styles.inputDescription}>
              * URL should point to a plain text file containing domain rules,
              separated by new lines.
            </Text>
            <View style={styles.line} />
            <Text style={styles.inputLabel}>Local Rules (one per line):</Text>
            <TextInput
              style={styles.multilineInput}
              placeholder="example.com, facebook.com"
              placeholderTextColor={placeholderTextColor}
              value={localRulesText}
              onChangeText={value => updateProfile({ localRulesText: value })}
              autoCapitalize="none"
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.inputDescription}>
              * Domains listed here are merged with the Imported Rules (if any)
              when you connect. Press Import to refresh the Imported Rules.
            </Text>
            <View style={styles.line} />

            <View style={styles.row}>
              <Text style={styles.rowLabel}>
                * Effective rules: {effectiveRules(profile).length}
                {'\n'}* Imported:{' '}
                {importedAt ? new Date(importedAt).toLocaleString() : 'never'}
              </Text>
              <View style={styles.rowSpacer} />
              <TouchableOpacityButton
                touchableOpacityStyles={[
                  styles.modeButton,
                  styles.modeButtonWide,
                ]}
                textStyles={styles.modeButtonText}
                title="Import"
                onPress={async () => {
                  const result = await importRemoteRules(profile);
                  if (!result.ok) {
                    alert(
                      'Import failed',
                      result.error.kind === 'noURL'
                        ? 'Enter a Remote Rules URL to import.'
                        : result.error.message,
                    );
                    return;
                  }
                  // Patch only the imported fields so edits made during the fetch
                  // are not reverted by the pre-await profile snapshot.
                  const { importedRules, importedAt: at } = result.value;
                  updateProfile({ importedRules, importedAt: at });
                }}
              />
            </View>
          </>
        ) : null}
      </View>
      <View style={styles.actionRow}>
        {!isCreateMode ? (
          <TouchableOpacityButton
            touchableOpacityStyles={[
              styles.actionButton,
              styles.deleteActionButton,
            ]}
            title="Delete"
            testID="profile-delete"
            onPress={handleDelete}
          />
        ) : null}
        <TouchableOpacityButton
          touchableOpacityStyles={[
            styles.actionButton,
            !canCommit && styles.actionButtonDisabled,
          ]}
          title={isCreateMode ? 'Create' : 'Save'}
          testID={isCreateMode ? 'profile-create' : 'profile-save'}
          disabled={!canCommit}
          onPress={handleCommit}
        />
      </View>
    </MainScreen>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: {
      marginBottom: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
      color: theme.colors.textPrimary,
    },
    advancedHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    advancedChevron: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
      color: theme.colors.textPrimary,
    },
    inputLabel: {
      fontSize: 12,
      marginBottom: 4,
      color: theme.colors.textSecondary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.textPrimary,
    },
    inputDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 12,
      textAlign: 'justify',
    },
    passwordInput: {
      backgroundColor: theme.colors.inputBackgroundStrong,
      color: theme.colors.textPrimary,
    },
    multilineInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.textPrimary,
      minHeight: 100,
    },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    rowLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.textPrimary,
    },
    rowButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      overflow: 'hidden',
    },
    rowSpacer: { width: 8 },
    line: {
      height: 1,
      backgroundColor: theme.colors.divider,
      marginVertical: 12,
    },
    modeButton: {
      width: 70,
      height: 40,
      padding: 4,
    },
    modeButtonWide: {
      width: 80,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    actionButton: {
      flex: 1,
      width: 'auto',
      height: 44,
    },
    deleteActionButton: {
      backgroundColor: theme.colors.danger,
    },
    actionButtonDisabled: {
      backgroundColor: theme.colors.buttonInactive,
    },
    protocolButton: {
      width: 60,
      height: 40,
      padding: 4,
    },
    modeButtonActive: {
      backgroundColor: theme.colors.buttonPrimary,
    },
    modeButtonInactive: {
      backgroundColor: theme.colors.buttonInactive,
    },
    modeButtonText: {
      color: theme.colors.buttonPrimaryText,
      fontSize: 12,
    },
  });
}
