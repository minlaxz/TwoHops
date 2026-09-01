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
// Advanced pattern, issue #68). State is deliberately local and unpersisted:
// defaults reset on every visit.
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
  return StyleSheet.create({
    section: {
      marginBottom: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerExpanded: {
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    chevron: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
  });
}
