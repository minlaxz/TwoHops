import { StyleSheet, TouchableOpacity, Text } from 'react-native';
import { CustomButtonProps } from '../types';
import { useAppTheme } from '../context/ThemeContext';

export const TouchableOpacityButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  disabled,
  touchableOpacityStyles,
  textStyles,
}) => {
  const { theme } = useAppTheme();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: theme.colors.buttonPrimary,
          borderColor: theme.colors.border,
        },
        touchableOpacityStyles,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.buttonText,
          { color: theme.colors.buttonPrimaryText },
          textStyles,
        ]}
      >
        {title}
      </Text>
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

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled}>
      <Text
        style={[
          styles.link,
          {
            color: theme.colors.link,
            textDecorationColor: theme.colors.link,
          },
          textStyles,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 50,
    width: '50%',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    padding: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  link: { textDecorationLine: 'underline' },
});
