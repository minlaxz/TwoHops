import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { trigger } from 'react-native-haptic-feedback';
import type { DisplayState } from '../services/tunnelSession';
import type { AppTheme } from '../theme/colors';
import { useAppTheme } from '../context/ThemeContext';

type Props = {
  display: DisplayState;
  onPress: () => void;
};

const LABEL: Record<DisplayState, string> = {
  stopped: 'Start tunnel',
  busy: 'Tunnel busy',
  running: 'Stop tunnel',
};

// The floating connect control is the Dashboard's Display State expression
// (issue #79): neutral Stopped, amber pulsing Busy, green glowing Running.
// Color is information and never gated; pulse and glow are decoration and
// respect reduce-motion.
export default function ConnectControl({ display, onPress }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();

  const pulse = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(pulse);
    cancelAnimation(glow);
    if (reduceMotion) {
      pulse.value = 1;
      glow.value = 0;
      return;
    }
    pulse.value =
      display === 'busy'
        ? withRepeat(
            withSequence(
              withTiming(1.08, { duration: 600 }),
              withTiming(1, { duration: 600 }),
            ),
            -1,
          )
        : withTiming(1, { duration: 200 });
    glow.value = withTiming(display === 'running' ? 1 : 0, { duration: 400 });
  }, [display, reduceMotion, pulse, glow]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    shadowOpacity: 0.2 + glow.value * 0.4,
    shadowRadius: 6 + glow.value * 10,
  }));

  const handlePress = () => {
    trigger('impactLight');
    onPress();
  };

  return (
    <Animated.View
      style={[
        styles.fab,
        { backgroundColor: theme.colors.status[display] },
        display === 'running' && styles.fabGlow,
        animatedStyle,
      ]}
    >
      <Pressable
        testID="fab"
        accessibilityRole="button"
        accessibilityLabel={LABEL[display]}
        accessibilityState={{ disabled: display === 'busy' }}
        disabled={display === 'busy'}
        onPress={handlePress}
        style={styles.press}
      >
        {display === 'busy' ? (
          <ActivityIndicator color={theme.colors.onAccent} />
        ) : (
          <Ionicons
            name={display === 'running' ? 'stop' : 'play'}
            size={24}
            color={theme.colors.onAccent}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, spacing, radius, elevation } = theme;
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      right: spacing.xl,
      bottom: spacing.xl,
      width: 64,
      height: 64,
      borderRadius: radius.pill,
      ...elevation.level2,
    },
    // Glow tints the shadow green; opacity/radius animate above.
    fabGlow: {
      shadowColor: colors.status.running,
    },
    press: {
      flex: 1,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
