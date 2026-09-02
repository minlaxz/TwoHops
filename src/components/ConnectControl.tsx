import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
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
import type { DisplayState } from '../services/tunnelSession';
import type { AppTheme } from '../theme/colors';
import { useAppTheme } from '../context/ThemeContext';
import PressableScale from './PressableScale';

type Props = {
  display: DisplayState;
  onPress: () => void;
};

const SIZE = 64;

const PER_STATE: Record<
  DisplayState,
  { label: string; icon: 'play' | 'stop' | null }
> = {
  stopped: { label: 'Start tunnel', icon: 'play' },
  busy: { label: 'Tunnel busy', icon: null },
  running: { label: 'Stop tunnel', icon: 'stop' },
};

// The floating connect control is the Dashboard's Display State expression
// (issue #79): neutral Stopped, amber pulsing Busy, green glowing Running.
// Color is information and never gated; pulse and glow are decoration and
// respect reduce-motion. The glow is a halo view rather than a shadow so it
// renders on Android too.
export default function ConnectControl({ display, onPress }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();
  const { label, icon } = PER_STATE[display];

  const pulse = useSharedValue(1);
  const glow = useSharedValue(0);
  const { duration, scale } = theme.motion;

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
              withTiming(scale.pulse, { duration: duration.slow }),
              withTiming(1, { duration: duration.slow }),
            ),
            -1,
          )
        : withTiming(1, { duration: duration.fast });
    glow.value = withTiming(display === 'running' ? 1 : 0, {
      duration: duration.base,
    });
  }, [display, reduceMotion, pulse, glow, duration, scale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.35,
    transform: [{ scale: 1 + glow.value * 0.35 }],
  }));

  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />
      <Animated.View
        style={[
          styles.fab,
          { backgroundColor: theme.colors.status[display] },
          pulseStyle,
        ]}
      >
        <PressableScale
          testID="fab"
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: icon === null }}
          disabled={icon === null}
          onPress={onPress}
          style={styles.press}
        >
          {icon === null ? (
            <ActivityIndicator color={theme.colors.onAccent} />
          ) : (
            <Ionicons name={icon} size={24} color={theme.colors.onAccent} />
          )}
        </PressableScale>
      </Animated.View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, spacing, radius, elevation } = theme;
  return StyleSheet.create({
    anchor: {
      position: 'absolute',
      right: spacing.xl,
      bottom: spacing.xl,
      width: SIZE,
      height: SIZE,
    },
    halo: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.pill,
      backgroundColor: colors.status.running,
    },
    fab: {
      width: SIZE,
      height: SIZE,
      borderRadius: radius.pill,
      ...elevation.level2,
    },
    press: {
      flex: 1,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
