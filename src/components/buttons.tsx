import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import PressableScale from './PressableScale';
import { CustomButtonProps } from '../types';
import { useAppTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme/colors';

export const TouchableOpacityButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  disabled,
  testID,
  touchableOpacityStyles,
  textStyles,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <PressableScale
      style={[styles.button, touchableOpacityStyles]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
    >
      <Text style={[styles.buttonText, textStyles]}>{title}</Text>
    </PressableScale>
  );
};

export const TouchableOpacityLink: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  disabled,
  textStyles,
}) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <PressableScale onPress={onPress} disabled={disabled}>
      <Text style={[styles.link, textStyles]}>{title}</Text>
    </PressableScale>
  );
};

function createStyles(theme: AppTheme) {
  const { colors, spacing, radius, typography } = theme;
  return StyleSheet.create({
    button: {
      height: 50,
      width: '50%',
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: radius.sm,
      padding: spacing.sm,
      backgroundColor: colors.buttonPrimary,
    },
    buttonText: {
      ...typography.body,
      fontWeight: '600',
      color: colors.buttonPrimaryText,
    },
    link: {
      ...typography.body,
      textDecorationLine: 'underline',
      color: colors.link,
      textDecorationColor: colors.link,
    },
  });
}
