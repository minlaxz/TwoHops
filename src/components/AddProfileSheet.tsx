import React, { useCallback, useMemo, type RefObject } from 'react';
import { StyleSheet, Text } from 'react-native';
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

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  onNewProfile: () => void;
  onPasteLink: () => void;
};

// The add-profile menu (issue #81): a bottom sheet with the two routes the
// "+" control offers. Presentation is imperative through sheetRef; each
// action dismisses the sheet before routing so the editor lands on a clean
// Dashboard.
export default function AddProfileSheet({
  sheetRef,
  onNewProfile,
  onPasteLink,
}: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const choose = (action: () => void) => () => {
    sheetRef.current?.dismiss();
    action();
  };

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
        <Text style={styles.title}>Add profile</Text>
        <PressableScale
          testID="profile-add-new"
          accessibilityRole="button"
          style={styles.action}
          onPress={choose(onNewProfile)}
        >
          <Ionicons
            name="create-outline"
            size={22}
            color={theme.colors.textPrimary}
          />
          <Text style={styles.actionLabel}>New profile</Text>
        </PressableScale>
        <PressableScale
          testID="profile-add-link"
          accessibilityRole="button"
          style={styles.action}
          onPress={choose(onPasteLink)}
        >
          <Ionicons
            name="link-outline"
            size={22}
            color={theme.colors.textPrimary}
          />
          <Text style={styles.actionLabel}>Paste profile link</Text>
        </PressableScale>
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
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
    },
    actionLabel: {
      ...typography.body,
      color: colors.textPrimary,
    },
  });
}
