import React, { useCallback, useMemo, useState } from 'react';
import { Text, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Config from 'react-native-config';
import MainScreen from '../components/views';
import CollapsibleSection from '../components/CollapsibleSection';
import SegmentedControl from '../components/SegmentedControl';
import { useAppTheme } from '../context/ThemeContext';
import { useLogSettings } from '../context/LogSettingsContext';
import type { AppTheme, ThemePreference } from '../theme/colors';

// ponytail: package.json is this repo's release version source of truth;
// switch to react-native-device-info if native build numbers ever diverge.
const APP_VERSION: string = require('../../package.json').version;
// Build number is CI-injected via .env (ENV_BUILD_NUMBER); absent in local dev.
const BUILD_NUMBER: string | undefined = Config.ENV_BUILD_NUMBER;
// TrustTunnel core library version. Source of truth: android/app/build.gradle
// ("com.adguard.trusttunnel:trusttunnel-client-android:1.1.3") — update by
// hand on pin bumps. iOS bundles no core today.
const CORE_VERSION = '1.1.3';

const aboutRows: [string, string][] = [
  [
    'App Version',
    BUILD_NUMBER ? `${APP_VERSION} (${BUILD_NUMBER})` : APP_VERSION,
  ],
  ['Core Version', CORE_VERSION],
  ['App License', 'Apache-2.0'],
  ['Core License', 'Apache-2.0'],
];

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const { theme, themePreference, setThemePreference } = useAppTheme();
  const {
    debugLoggingEnabled,
    trafficLoggingEnabled,
    setDebugLoggingEnabled,
    setTrafficLoggingEnabled,
  } = useLogSettings();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // The theme already defines switch colors (issue #81 applies them).
  // thumbColor is one value per switch, so the on/off thumb follows the
  // track via the platform default; iOS ignores it anyway.
  const switchColors = {
    trackColor: {
      false: theme.colors.switchTrackFalse,
      true: theme.colors.switchTrackTrue,
    },
    thumbColor: theme.colors.switchThumbOn,
    ios_backgroundColor: theme.colors.switchTrackFalse,
  };
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
            {...switchColors}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Traffic Logging</Text>
          <Switch
            testID="settings-traffic-logging"
            value={trafficLoggingEnabled}
            onValueChange={setTrafficLoggingEnabled}
            {...switchColors}
          />
        </View>
        <Text style={styles.description}>
          Most users don't need these. Debug Logs narrate the app lifecycle for
          troubleshooting; Traffic Logs record tunnel query activity. Turning a
          toggle off stops capture but keeps what was already captured.
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
