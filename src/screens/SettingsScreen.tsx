import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Text, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Config from 'react-native-config';
import MainScreen from '../components/views';
import CollapsibleSection from '../components/CollapsibleSection';
import SegmentedControl from '../components/SegmentedControl';
import { useAppTheme } from '../context/ThemeContext';
import { useLogSettings } from '../context/LogSettingsContext';
import { useUpdateCheck } from '../context/UpdateCheckContext';
import PressableScale from '../components/PressableScale';
import { INSTALLED_VERSION } from '../services/updateCheck';
import type { AppTheme, ThemePreference } from '../theme/colors';
import { CORE_LOG_LEVELS, type CoreLogLevel } from '../services/coreLog';

// Build number is CI-injected via .env (ENV_BUILD_NUMBER); absent in local dev.
const BUILD_NUMBER: string | undefined = Config.ENV_BUILD_NUMBER;
// TrustTunnel core library version. Source of truth: android/app/build.gradle
// ("io.github.minlaxz:trusttunnel-client-android:1.1.5-twohops.1") — update by
// hand on pin bumps. iOS bundles no core today.
const CORE_VERSION = '1.1.5-twohops.1';

const aboutRows: [string, string][] = [
  [
    'App Version',
    BUILD_NUMBER ? `${INSTALLED_VERSION} (${BUILD_NUMBER})` : INSTALLED_VERSION,
  ],
  ['Core Version', CORE_VERSION],
  ['App License', 'Apache-2.0'],
  ['Core License', 'Apache-2.0'],
];

const coreLevelOptions: { value: CoreLogLevel; label: string }[] =
  CORE_LOG_LEVELS.map(value => ({ value, label: value }));

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// Update row (issue #87): value and tap action follow the Update Check status.
function UpdateRow({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const { status, available, check } = useUpdateCheck();
  const value =
    status === 'checking'
      ? 'Checking…'
      : status === 'available'
      ? `${available!.version} available`
      : status === 'up-to-date'
      ? 'Up to date'
      : 'Check failed';
  const onPress = () => {
    if (status === 'available') {
      Linking.openURL(available!.url).catch(() => {});
    } else {
      check({ manual: true });
    }
  };
  return (
    <PressableScale
      testID="settings-update"
      accessibilityRole="button"
      accessibilityLabel={`Update, ${value}`}
      disabled={status === 'checking'}
      onPress={onPress}
      style={styles.row}
    >
      <Text style={styles.rowLabel}>Update</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </PressableScale>
  );
}

export default function SettingsScreen() {
  const { theme, themePreference, setThemePreference } = useAppTheme();
  const { enabled: updateCheckEnabled } = useUpdateCheck();
  const {
    debugLoggingEnabled,
    trafficLoggingEnabled,
    coreLoggingEnabled,
    coreLogLevel,
    setDebugLoggingEnabled,
    setTrafficLoggingEnabled,
    setCoreLoggingEnabled,
    setCoreLogLevel,
  } = useLogSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // The theme already defines switch colors (issue #81 applies them).
  const switchColors = (value: boolean) => ({
    trackColor: {
      false: theme.colors.switchTrackFalse,
      true: theme.colors.switchTrackTrue,
    },
    thumbColor: value
      ? theme.colors.switchThumbOn
      : theme.colors.switchThumbOff,
    ios_backgroundColor: theme.colors.switchTrackFalse,
  });
  // Bottom tabs keep this screen mounted across tab switches, but issue #68
  // wants collapse defaults reset on every visit: bump the key on blur so
  // the sections remount (while hidden) with their defaults.
  const [visitKey, setVisitKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      return () => setVisitKey(key => key + 1);
    }, []),
  );

  return (
    <MainScreen>
      <CollapsibleSection
        key={`appearance-${visitKey}`}
        title="Appearance"
        initialExpanded={false}
        testID="settings-section-appearance"
      >
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Theme</Text>
        </View>
        <SegmentedControl
          testID="settings-theme"
          options={themeOptions}
          value={themePreference}
          onChange={setThemePreference}
        />
        <Text style={styles.description}>
          Use "System" to follow your phone appearance settings.
        </Text>
      </CollapsibleSection>
      <CollapsibleSection
        key={`about-${visitKey}`}
        title="About"
        initialExpanded
        testID="settings-section-about"
      >
        {aboutRows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
          </View>
        ))}
        {updateCheckEnabled && <UpdateRow styles={styles} />}
        <Text style={styles.description}>
          TwoHops is developed by Min. The core is developed by AdGuard under
          the name TrustTunnel.
        </Text>
      </CollapsibleSection>
      <CollapsibleSection
        key={`debug-${visitKey}`}
        title="Debug"
        initialExpanded={false}
        testID="settings-section-debug"
      >
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Debug Logging</Text>
          <Switch
            testID="settings-debug-logging"
            value={debugLoggingEnabled}
            onValueChange={setDebugLoggingEnabled}
            {...switchColors(debugLoggingEnabled)}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Traffic Logging</Text>
          <Switch
            testID="settings-traffic-logging"
            value={trafficLoggingEnabled}
            onValueChange={setTrafficLoggingEnabled}
            {...switchColors(trafficLoggingEnabled)}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Core Logging</Text>
          <Switch
            testID="settings-core-logging"
            value={coreLoggingEnabled}
            onValueChange={setCoreLoggingEnabled}
            {...switchColors(coreLoggingEnabled)}
          />
        </View>
        {coreLoggingEnabled ? (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Core Log Level</Text>
            </View>
            <SegmentedControl
              testID="settings-core-log-level"
              options={coreLevelOptions}
              value={coreLogLevel}
              onChange={setCoreLogLevel}
            />
          </>
        ) : null}
        <Text style={styles.description}>
          Most users don't need these. Debug Logs narrate the app lifecycle for
          troubleshooting; Traffic Logs record tunnel query activity; Core Logs
          show the tunnel core's own lines at the chosen level (debug shows DNS
          queries). Turning a toggle off stops capture but keeps what was
          already captured.
        </Text>
      </CollapsibleSection>
    </MainScreen>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, spacing, typography } = theme;
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    rowLabel: {
      ...typography.body,
      flex: 1,
      color: colors.textPrimary,
    },
    description: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    rowValue: {
      ...typography.body,
      color: colors.textSecondary,
    },
  });
}
