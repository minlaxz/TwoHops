import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import PressableScale from './PressableScale';
import { useAppTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme/colors';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  // Prefix for per-segment testIDs: `${testID}-${option.value}`.
  testID?: string;
};

// One control, one setting (issue #81): a radio group whose thumb slides to
// the selected segment. The slide is decoration and respects reduce-motion;
// the checked state is information and never animates.
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testID,
}: Props<T>) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const segmentWidth = width / options.length;
  const index = Math.max(
    0,
    options.findIndex(option => option.value === value),
  );
  const offset = useSharedValue(index * segmentWidth);

  useEffect(() => {
    const target = index * segmentWidth;
    offset.value = reduceMotion
      ? target
      : withTiming(target, { duration: theme.motion.duration.fast });
  }, [index, segmentWidth, reduceMotion, offset, theme]);

  const thumbStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      style={styles.track}
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width - theme.spacing.xs * 2)
      }
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, thumbStyle]}
        />
      ) : null}
      {options.map(option => {
        const checked = option.value === value;
        return (
          <PressableScale
            key={option.value}
            testID={testID ? `${testID}-${option.value}` : undefined}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            style={styles.segment}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.label, checked && styles.labelChecked]}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, spacing, radius, typography, elevation } = theme;
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      padding: spacing.xs,
      borderRadius: radius.sm + spacing.xs,
      backgroundColor: colors.inputBackgroundStrong,
    },
    thumb: {
      position: 'absolute',
      top: spacing.xs,
      bottom: spacing.xs,
      left: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceElevated,
      ...elevation.level1,
    },
    segment: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    labelChecked: {
      color: colors.textPrimary,
    },
  });
}
