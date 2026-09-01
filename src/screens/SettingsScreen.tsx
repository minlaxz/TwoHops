import React, { useMemo } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import Config from 'react-native-config';
import MainScreen from '../components/views';
import CollapsibleSection from '../components/CollapsibleSection';
import { TouchableOpacityButton } from '../components/buttons';
import { useAppTheme } from '../context/ThemeContext';
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

const themeOptions: ThemePreference[] = ['system', 'light', 'dark'];

export default function SettingsScreen() {
  const { theme, themePreference, setThemePreference } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <MainScreen>
      <CollapsibleSection
        title="Appearance"
        initialExpanded={false}
        testID="settings-section-appearance"
      >
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Theme: {themePreference}</Text>
        </View>
        <View style={styles.rowButtons}>
          {themeOptions.map(option => (
            <React.Fragment key={option}>
              <TouchableOpacityButton
                touchableOpacityStyles={[
                  styles.themeButton,
                  themePreference === option
                    ? styles.themeButtonActive
                    : styles.themeButtonInactive,
                ]}
                textStyles={styles.themeButtonText}
                title={option[0].toUpperCase() + option.slice(1)}
                onPress={() => setThemePreference(option)}
              />
              {option !== 'dark' ? <View style={styles.rowSpacer} /> : null}
            </React.Fragment>
          ))}
        </View>
        <Text style={styles.description}>
          Use "System" to follow your phone appearance settings.
        </Text>
      </CollapsibleSection>
      <CollapsibleSection
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
    </MainScreen>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
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
    description: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 12,
    },
    themeButton: {
      width: 90,
      height: 40,
      padding: 4,
    },
    themeButtonActive: {
      backgroundColor: theme.colors.buttonPrimary,
    },
    themeButtonInactive: {
      backgroundColor: theme.colors.buttonInactive,
    },
    themeButtonText: {
      color: theme.colors.buttonPrimaryText,
      fontSize: 12,
    },
    rowValue: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
  });
}
