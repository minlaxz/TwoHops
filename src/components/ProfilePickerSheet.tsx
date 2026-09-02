import React, { useCallback, useMemo, type RefObject } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from './PressableScale';
import { useAppTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme/colors';
import type { ProfileEntry } from '../services/profileStore';
import { profileSubtitle } from '../services/setupProfile';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  profiles: ProfileEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

// The Profile Picker (issue #90): the Profile List behind the Dashboard's
// Selected Profile row. Same construction as AddProfileSheet; the Dashboard
// decides whether a tap may open it (Display State Stopped only). No add
// row here — "+" on the card is the only way to add a Profile.
export default function ProfilePickerSheet({
  sheetRef,
  profiles,
  selectedId,
  onSelect,
}: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={1}
        style={[props.style, styles.backdrop]}
      />
    ),
    [styles.backdrop],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheet}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView
        style={[
          styles.content,
          { paddingBottom: insets.bottom + theme.spacing.lg },
        ]}
      >
        <Text style={styles.title}>Choose profile</Text>
        {profiles.map(entry => {
          const selected = entry.id === selectedId;
          return (
            <PressableScale
              key={entry.id}
              testID={`profile-picker-row-${entry.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={styles.row}
              onPress={() => {
                sheetRef.current?.dismiss();
                onSelect(entry.id);
              }}
            >
              <View style={styles.rowText}>
                <Text
                  style={[styles.name, selected && styles.nameSelected]}
                  numberOfLines={1}
                >
                  {entry.name}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {profileSubtitle(entry)}
                </Text>
              </View>
              {selected ? (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={theme.colors.accent}
                />
              ) : null}
            </PressableScale>
          );
        })}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function createStyles(theme: AppTheme) {
  const { colors, spacing, radius, typography } = theme;
  return StyleSheet.create({
    backdrop: {
      backgroundColor: colors.overlay,
    },
    sheet: {
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
    },
    handle: {
      backgroundColor: colors.border,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    title: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
    },
    rowText: {
      flex: 1,
    },
    name: {
      ...typography.body,
      color: colors.textPrimary,
    },
    nameSelected: {
      fontWeight: '600',
      color: colors.accent,
    },
    subtitle: {
      ...typography.caption,
      color: colors.textSecondary,
    },
  });
}
