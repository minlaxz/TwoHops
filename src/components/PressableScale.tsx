import React, { useCallback } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../context/ThemeContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  // Pressed scale; defaults to the theme's press token.
  scale?: number;
};

// The app's one touchable (issue #80): dims and shrinks slightly while
// pressed. The opacity dip is feedback and always applies; the scale is
// decoration and respects reduce-motion.
export default function PressableScale({
  style,
  scale,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const pressScale = scale ?? theme.motion.scale.press;
  const duration = theme.motion.duration.fast;

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      pressed.value = reduceMotion ? 1 : withTiming(1, { duration });
      onPressIn?.(event);
    },
    [pressed, reduceMotion, duration, onPressIn],
  );
  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      pressed.value = reduceMotion ? 0 : withTiming(0, { duration });
      onPressOut?.(event);
    },
    [pressed, reduceMotion, duration, onPressOut],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * 0.3,
    transform: reduceMotion
      ? []
      : [{ scale: 1 - pressed.value * (1 - pressScale) }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    />
  );
}
