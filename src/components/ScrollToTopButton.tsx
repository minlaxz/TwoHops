import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import PressableScale from './PressableScale';
import { useAppTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme/colors';

type Props = {
  /** Render nothing while false (list near the top). */
  visible: boolean;
  onPress: () => void;
  testID?: string;
};

/** Floating round button, bottom-right of a list, that jumps back to the
 * top (issue #103). The parent decides visibility from its scroll offset. */
export default function ScrollToTopButton({ visible, onPress, testID }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  if (!visible) {
    return null;
  }
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Scroll to top"
      style={styles.button}
      onPress={onPress}
    >
      <Ionicons
        name="arrow-up"
        size={22}
        color={theme.colors.buttonPrimaryText}
      />
    </PressableScale>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, spacing, elevation } = theme;
  return StyleSheet.create({
    button: {
      position: 'absolute',
      right: spacing.sm,
      bottom: spacing.sm,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonPrimary,
      ...elevation.level2,
    },
  });
}
