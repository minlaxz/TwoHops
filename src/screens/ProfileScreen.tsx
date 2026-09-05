import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Text, StyleSheet, View, TextInput } from 'react-native';
import Animated, {
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import PressableScale from '../components/PressableScale';
import SegmentedControl from '../components/SegmentedControl';
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
import {
  applyProfileLink,
  defaultProfile,
  effectiveRules,
  importRemoteRules,
  joinHostPort,
  missingFields,
  resolvedBypassDnsServers,
  profileLinkErrorMessage,
  splitHostPort,
  updateProfile as updateProfileIntent,
  updateServer as updateServerIntent,
  type MissingField,
  type ProfileEnv,
  type ProfileLinkError,
  type SetupProfile,
} from '../services/setupProfile';
import { displayState } from '../services/tunnelSession';
import { useAppTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme/colors';
import type { BypassDnsRoute, RoutingMode, VpnProtocol } from '../types';

const protocolOptions: { value: VpnProtocol; label: string }[] = [
  { value: 'Http/2', label: 'Http/2' },
  { value: 'QUIC', label: 'QUIC' },
];
const bypassRouteOptions: { value: BypassDnsRoute; label: string }[] = [
  { value: 'direct', label: 'Direct' },
  { value: 'tunnel', label: 'Tunnel' },
];
const routingOptions: { value: RoutingMode; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'selective', label: 'Selective' },
];
// How a missing field reads beside the disabled Save (#126).
const missingLabels: Record<MissingField, string> = {
  name: 'name',
  ipAddress: 'address',
  port: 'port',
  domain: 'TLS domain',
  login: 'username',
  password: 'password',
};
const DNS_DOC_URL =
  'https://github.com/minlaxz/TwoHops/blob/main/docs/dns-resolution-paths.md';
// Rows added by hand stop at three; a longer stored list still shows whole.
const MAX_DNS_ROWS = 3;

// Shared with DashboardScreen's RootStackParamList so the two cannot drift.
export type ProfileScreenParams = {
  profileId?: string;
  mode?: 'create';
  // 'link' (from the add sheet's "Paste profile link") opens Link Mode (#127).
  focus?: 'link';
};

// DNS rows are UI over a string list: one row per entry, empty rows kept
// locally while typing and dropped from the list (#126). The list stays the
// source of truth; rows resync when it changes underneath (link apply).
function useDnsRows(list: string[]) {
  const joined = list.join(',');
  const [rows, setRows] = useState<string[]>(() => (list.length ? list : ['']));
  useEffect(() => {
    setRows(prev =>
      nonEmpty(prev).join(',') === joined ? prev : joined ? list : [''],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);
  return [rows, setRows] as const;
}
const nonEmpty = (rows: string[]) =>
  rows.map(row => row.trim()).filter(Boolean);

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
  // Link Mode (#127): the screen's paste-link face. Local state so Modify can
  // flip to the Profile Form with the same Draft; the Form never flips back.
  const [face, setFace] = useState<'form' | 'link'>(() =>
    isCreateMode && params?.focus === 'link' ? 'link' : 'form',
  );
  const isLinkMode = face === 'link';
  const entry = profiles.find(candidate => candidate.id === params?.profileId);
  const [url, setURL] = useState<string>('');
  // Link Mode status is derived, not stored: the last apply's parse result
  // plus the Draft's missing fields. `null` = nothing applied yet.
  const [linkResult, setLinkResult] = useState<
    { ok: true } | { ok: false; error: ProfileLinkError } | null
  >(null);
  const linkApplied = linkResult?.ok === true;
  // The Profile Draft: in-memory until Save commits it (blank for create,
  // seeded from the entry for edit). Its only name is the server name (#89).
  const [draft, setDraft] = useState<SetupProfile>(() =>
    entry && !isCreateMode ? entry : defaultProfile(Config as ProfileEnv),
  );
  const [isTouched, setIsTouched] = useState(false);
  const committedRef = useRef(false);

  const profile = isCreateMode || entry ? draft : undefined;

  const [dnsRows, setDnsRows] = useDnsRows(profile?.dnsServers ?? []);
  const [bypassRows, setBypassRows] = useDnsRows(
    profile?.bypassDnsServers ?? [],
  );
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();
  // The card and the action row ease when rows or the route control appear.
  const layout = reduceMotion
    ? undefined
    : LinearTransition.duration(theme.motion.duration.base);
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
  const patchDraft = (transform: (prev: SetupProfile) => SetupProfile) => {
    setDraft(transform);
    setIsTouched(true);
  };
  const updateProfile = (patch: Parameters<typeof updateProfileIntent>[1]) =>
    patchDraft(prev => updateProfileIntent(prev, patch));
  const updateServer = (patch: Parameters<typeof updateServerIntent>[1]) =>
    patchDraft(prev => updateServerIntent(prev, patch));
  const { host, port } = splitHostPort(server.ipAddress);
  const sameAsTunnel = profile.bypassDnsSource === 'same-as-tunnel';

  // The Completeness gate: Save can never mint an incomplete profile. Save
  // is additionally gated on the touched flag (issue #71): an untouched edit
  // draft has nothing to save, however complete it is.
  const missing = missingFields(profile);
  // Link Mode additionally needs an applied link: Save is for what the link
  // yielded, never for an env-seeded blank Draft.
  const canCommit =
    missing.length === 0 &&
    (isCreateMode || isTouched) &&
    (!isLinkMode || linkApplied);
  const showMissing = missing.length > 0 && (!isLinkMode || linkApplied);
  const handleCommit = () => {
    if (committedRef.current) {
      return; // a second tap before the pop lands must not commit twice
    }
    committedRef.current = true;
    if (isCreateMode) {
      createProfile(draft);
    } else if (entry) {
      saveProfile(entry.id, draft);
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

  const renderDnsRows = (
    idPrefix: string,
    rows: string[],
    setRows: (update: (prev: string[]) => string[]) => void,
    write: (list: string[]) => void,
  ) => {
    const commit = (next: string[]) => {
      setRows(() => next);
      write(nonEmpty(next));
    };
    return (
      <>
        {rows.map((row, index) => (
          <View key={index} style={styles.dnsRow}>
            <TextInput
              testID={`${idPrefix}-row-${index}`}
              style={[styles.input, styles.dnsInput]}
              placeholder="DNS server"
              placeholderTextColor={placeholderTextColor}
              value={row}
              onChangeText={value =>
                commit(rows.map((r, i) => (i === index ? value : r)))
              }
              autoCapitalize="none"
              autoCorrect={false}
            />
            <PressableScale
              testID={`${idPrefix}-remove-${index}`}
              accessibilityRole="button"
              accessibilityLabel="Remove DNS server"
              style={styles.iconButton}
              onPress={() => {
                const next = rows.filter((_, i) => i !== index);
                commit(next.length ? next : ['']);
              }}
            >
              <Ionicons
                name="remove-circle-outline"
                size={22}
                color={theme.colors.textSecondary}
              />
            </PressableScale>
          </View>
        ))}
        {rows.length < MAX_DNS_ROWS ? (
          <PressableScale
            testID={`${idPrefix}-add`}
            accessibilityRole="button"
            accessibilityLabel="Add DNS server"
            style={styles.addRow}
            onPress={() => setRows(prev => [...prev, ''])}
          >
            <Ionicons
              name="add-circle-outline"
              size={22}
              color={theme.colors.link}
            />
            <Text style={styles.addRowLabel}>Add server</Text>
          </PressableScale>
        ) : null}
      </>
    );
  };

  return (
    <MainScreen>
      <Text style={styles.title}>Configurations</Text>
      {isLinkMode ? (
        <View style={styles.section}>
          <TextInput
            testID="profile-link-input"
            autoFocus
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
          {linkResult && !linkResult.ok ? (
            <Text
              testID="profile-link-error"
              style={[styles.inputDescription, styles.warning]}
            >
              {profileLinkErrorMessage(linkResult.error)}
            </Text>
          ) : null}
          <TouchableOpacityButton
            touchableOpacityStyles={[styles.modeButton, styles.modeButtonWide]}
            textStyles={styles.modeButtonText}
            title="Apply Link"
            testID="profile-link-apply"
            onPress={() => {
              // ADR 0005: the link patches the Profile Draft in place —
              // nothing reaches the Profile List until Save. A parse failure
              // shows inline and leaves the Draft as it was.
              const result = applyProfileLink(profile, url);
              if (!result.ok) {
                setLinkResult(result);
                return;
              }
              setLinkResult({ ok: true });
              patchDraft(() => result.value);
              setURL('');
            }}
          />
        </View>
      ) : (
        <Animated.View style={styles.section} layout={layout}>
          <TextInput
            testID="server-name-input"
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={placeholderTextColor}
            value={server.name}
            onChangeText={value => updateServer({ name: value })}
            autoCapitalize="none"
          />

          <Text style={styles.groupTitle}>Server</Text>
          <View style={styles.dnsRow}>
            <TextInput
              testID="server-address-input"
              style={[styles.input, styles.dnsInput]}
              placeholder="Server address"
              placeholderTextColor={placeholderTextColor}
              value={host}
              onChangeText={value =>
                updateServer({ ipAddress: joinHostPort(value, port) })
              }
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              testID="server-port-input"
              style={[styles.input, styles.portInput]}
              placeholder="443"
              placeholderTextColor={placeholderTextColor}
              value={port}
              onChangeText={value =>
                updateServer({ ipAddress: joinHostPort(host, value.trim()) })
              }
              keyboardType="number-pad"
            />
          </View>
          <TextInput
            testID="server-domain-input"
            style={styles.input}
            placeholder="TLS Domain Name"
            placeholderTextColor={placeholderTextColor}
            value={server.domain}
            onChangeText={value => updateServer({ domain: value })}
            autoCapitalize="none"
          />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Protocol</Text>
          </View>
          <SegmentedControl
            testID="profile-protocol"
            options={protocolOptions}
            value={server.vpnProtocol}
            onChange={vpnProtocol => updateServer({ vpnProtocol })}
          />

          <Text style={styles.groupTitle}>User</Text>
          <TextInput
            testID="server-login-input"
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={placeholderTextColor}
            value={server.login}
            onChangeText={value => updateServer({ login: value })}
            autoCapitalize="none"
          />
          <TextInput
            testID="server-password-input"
            style={[styles.input, styles.passwordInput]}
            placeholder="Password"
            placeholderTextColor={placeholderTextColor}
            value={server.password}
            onChangeText={value => updateServer({ password: value })}
            secureTextEntry
          />

          <Text style={styles.groupTitle}>DNS</Text>
          <Text style={styles.inputLabel}>Tunnel DNS Servers:</Text>
          {renderDnsRows('dns', dnsRows, setDnsRows, dnsServers =>
            updateProfile({ dnsServers }),
          )}
          <Text style={styles.inputLabel}>Bypass DNS Servers:</Text>
          <PressableScale
            testID="bypass-same-as-tunnel"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: sameAsTunnel }}
            style={styles.checkboxRow}
            onPress={() =>
              // Rechecking returns to `same-as-tunnel`; the custom list is
              // kept in the document but unread (ADR 0007).
              updateProfile({
                bypassDnsSource: sameAsTunnel ? 'custom' : 'same-as-tunnel',
              })
            }
          >
            <Ionicons
              name={sameAsTunnel ? 'checkbox' : 'square-outline'}
              size={22}
              color={
                sameAsTunnel ? theme.colors.accent : theme.colors.textSecondary
              }
            />
            <Text style={styles.rowLabel}>Same as above</Text>
          </PressableScale>
          {!sameAsTunnel
            ? renderDnsRows('bypass-dns', bypassRows, setBypassRows, list =>
                updateProfile({ bypassDnsServers: list }),
              )
            : null}
          {resolvedBypassDnsServers(profile).length > 0 && (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Bypass DNS Route</Text>
              </View>
              <SegmentedControl
                testID="profile-bypass-route"
                options={bypassRouteOptions}
                value={profile.bypassDnsRoute}
                onChange={bypassDnsRoute => updateProfile({ bypassDnsRoute })}
              />
              {profile.bypassDnsRoute === 'direct' ? (
                <Text style={[styles.inputDescription, styles.warning]}>
                  DNS server could be exposed, Tunnel mode is recommended.
                </Text>
              ) : (
                <View style={styles.rowGap} />
              )}
            </>
          )}
          <Text style={styles.inputDescription}>
            Plain DNS (IP), DoT (tls://) and DoH (https://) servers are
            supported.{' '}
            <Text
              testID="dns-doc-link"
              style={styles.linkText}
              onPress={() => Linking.openURL(DNS_DOC_URL).catch(() => {})}
            >
              DNS resolution paths
            </Text>
          </Text>

          <Text style={styles.groupTitle}>Routing</Text>
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
          <View style={styles.line} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Mode</Text>
          </View>
          <SegmentedControl
            testID="profile-routing"
            options={routingOptions}
            value={routingMode}
            onChange={mode => updateProfile({ routingMode: mode })}
          />
          <Text style={styles.inputDescription}>
            In most cases, "Selective" mode is recommended for better
            performance and battery life.
          </Text>
        </Animated.View>
      )}
      {showMissing ? (
        <Text testID="profile-missing" style={styles.missing}>
          {`Missing: ${missing.map(field => missingLabels[field]).join(', ')}`}
        </Text>
      ) : null}
      <Animated.View style={styles.actionRow} layout={layout}>
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
        {isLinkMode && linkApplied ? (
          <TouchableOpacityButton
            touchableOpacityStyles={[
              styles.actionButton,
              styles.modifyActionButton,
            ]}
            textStyles={styles.modifyActionButtonText}
            title="Modify"
            testID="profile-modify"
            onPress={() => setFace('form')}
          />
        ) : null}
        <TouchableOpacityButton
          touchableOpacityStyles={[
            styles.actionButton,
            !canCommit && styles.actionButtonDisabled,
          ]}
          title="Save"
          testID="profile-save"
          disabled={!canCommit}
          onPress={handleCommit}
        />
      </Animated.View>
    </MainScreen>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, spacing, radius, typography, card } = theme;
  const input = {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
  } as const;
  return StyleSheet.create({
    section: {
      marginBottom: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.md,
      ...card,
    },
    groupTitle: {
      ...typography.title,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
      color: colors.textPrimary,
    },
    title: {
      ...typography.title,
      marginBottom: spacing.sm,
      textAlign: 'center',
      color: colors.textPrimary,
    },
    inputLabel: {
      ...typography.caption,
      marginBottom: spacing.xs,
      color: colors.textSecondary,
    },
    input,
    inputDescription: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.md,
      textAlign: 'justify',
    },
    warning: {
      color: colors.danger,
    },
    linkText: {
      color: colors.link,
      textDecorationLine: 'underline',
    },
    passwordInput: {
      backgroundColor: colors.inputBackgroundStrong,
      color: colors.textPrimary,
    },
    multilineInput: {
      ...input,
      minHeight: 100,
    },
    dnsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dnsInput: {
      flex: 1,
    },
    portInput: {
      width: 84,
      textAlign: 'center',
    },
    iconButton: {
      marginBottom: spacing.md,
      padding: spacing.xs,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
      paddingVertical: spacing.xs,
    },
    addRowLabel: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.link,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
      paddingVertical: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    rowGap: { height: spacing.md },
    rowLabel: {
      ...typography.body,
      flex: 1,
      color: colors.textPrimary,
    },
    rowSpacer: { width: spacing.sm },
    line: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: spacing.md,
    },
    modeButton: {
      width: 70,
      height: 40,
      padding: spacing.xs,
    },
    modeButtonWide: {
      width: 80,
    },
    missing: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    actionButton: {
      flex: 1,
      width: 'auto',
      height: 44,
    },
    deleteActionButton: {
      backgroundColor: colors.danger,
    },
    // Secondary: outlined so it never reads as a disabled Save beside it.
    modifyActionButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    modifyActionButtonText: {
      color: colors.textPrimary,
    },
    actionButtonDisabled: {
      backgroundColor: colors.buttonInactive,
    },
    modeButtonText: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.buttonPrimaryText,
    },
  });
}
