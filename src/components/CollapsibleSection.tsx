import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme/colors';

type CollapsibleSectionProps = {
  title: string;
  initialExpanded?: boolean;
  testID?: string;
  children: React.ReactNode;
};

// Shared collapsible section card (extracted from the profile screen's inline
// Advanced pattern, issue #68). State is deliberately local and unpersisted;
// a screen that must reset defaults per visit remounts the section via key
// (see SettingsScreen).
// ponytail: uncontrolled only; add expanded/onToggle props when a caller
// needs to open it programmatically (e.g. profile Apply Link).
export default function CollapsibleSection({
  title,
  initialExpanded = false,
  testID,
  children,
}: CollapsibleSectionProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState(initialExpanded);

  return (
    <View style={styles.section}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={[styles.header, expanded ? styles.headerExpanded : null]}
        onPress={() => setExpanded(open => !open)}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>
      {expanded ? children : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, spacing, radius, typography, elevation } = theme;
  return StyleSheet.create({
    section: {
      marginBottom: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      ...elevation.level1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerExpanded: {
      marginBottom: spacing.md,
    },
    title: {
      ...typography.title,
      color: colors.textPrimary,
    },
    chevron: {
      ...typography.body,
      color: colors.textSecondary,
    },
  });
}
