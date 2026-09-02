import { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, Text } from 'react-native';
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
    <TouchableOpacity
      style={[styles.button, touchableOpacityStyles]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
    >
      <Text style={[styles.buttonText, textStyles]}>{title}</Text>
    </TouchableOpacity>
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
    <TouchableOpacity onPress={onPress} disabled={disabled}>
      <Text style={[styles.link, textStyles]}>{title}</Text>
    </TouchableOpacity>
  );
};

function createStyles(theme: AppTheme) {
  const { colors, spacing, radius, type } = theme;
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
      ...type.body,
      fontWeight: '600',
      color: colors.buttonPrimaryText,
    },
    link: {
      ...type.body,
      textDecorationLine: 'underline',
      color: colors.link,
      textDecorationColor: colors.link,
    },
  });
}
