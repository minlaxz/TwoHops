import React, { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { useAppTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme/colors';
import PressableScale from './PressableScale';

type CollapsibleSectionProps = {
  title: string;
  initialExpanded?: boolean;
  testID?: string;
  children: React.ReactNode;
};

type CollapsibleBodyProps = {
  expanded: boolean;
  children: React.ReactNode;
};

// The animated body of any collapsible (issue #80): fades in and out instead
// of snapping. Decorative, so reduce-motion turns it back into a snap.
// ponytail: fade only; a measured height slide needs onLayout bookkeeping.
export function CollapsibleBody({ expanded, children }: CollapsibleBodyProps) {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  if (!expanded) {
    return null;
  }
  const duration = theme.motion.duration.fast;
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(duration)}
      exiting={reduceMotion ? undefined : FadeOut.duration(duration)}
    >
      {children}
    </Animated.View>
  );
}

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
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(initialExpanded);

  return (
    <Animated.View
      style={styles.section}
      layout={
        reduceMotion
          ? undefined
          : LinearTransition.duration(theme.motion.duration.base)
      }
    >
      <PressableScale
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={[styles.header, expanded ? styles.headerExpanded : null]}
        onPress={() => setExpanded(open => !open)}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </PressableScale>
      <CollapsibleBody expanded={expanded}>{children}</CollapsibleBody>
    </Animated.View>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, spacing, radius, typography, card } = theme;
  return StyleSheet.create({
    section: {
      marginBottom: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.md,
      ...card,
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
