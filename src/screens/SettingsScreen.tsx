import React, { useMemo } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import MainScreen from '../components/views';
import { TouchableOpacityButton } from '../components/buttons';
import { useAppTheme } from '../context/ThemeContext';
import type { AppTheme, ThemePreference } from '../theme/colors';

// ponytail: package.json is this repo's release version source of truth;
// switch to react-native-device-info if native build numbers ever diverge.
const APP_VERSION: string = require('../../package.json').version;

const themeOptions: ThemePreference[] = ['system', 'light', 'dark'];

export default function SettingsScreen() {
  const { theme, themePreference, setThemePreference } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <MainScreen>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
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
      </View>
      <Text style={styles.versionFooter}>Version {APP_VERSION}</Text>
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
    versionFooter: {
      fontSize: 12,
      textAlign: 'center',
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
  });
}
