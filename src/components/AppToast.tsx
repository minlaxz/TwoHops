import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme/colors';

// Global transient notice (issue #58): mirrors AppAlert's context-hook shape.
// A new toast replaces the current one and restarts the dismiss timer.
type ToastFn = (message: string) => void;

const TOAST_DURATION_MS = 2500;

const ToastContext = createContext<ToastFn | null>(null);

export function useAppToast(): ToastFn {
  const toast = useContext(ToastContext);
  if (!toast) {
    throw new Error('useAppToast must be used within a ToastProvider');
  }
  return toast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ToastFn>(next => {
    setMessage(next);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message !== null ? (
        <View pointerEvents="none" style={styles.wrap}>
          <View style={styles.toast} testID="app-toast">
            <Text style={styles.text}>{message}</Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 96,
      alignItems: 'center',
    },
    toast: {
      maxWidth: '85%',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    text: {
      fontSize: 13,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
  });
}
