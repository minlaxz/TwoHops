import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme/colors';

// Custom replacement for Alert.alert (issue #55): themed, rounded, and
// rendered in the React tree so tests can drive it like any other view.
export type AppAlertButton = {
  text: string;
  style?: 'cancel' | 'destructive';
  onPress?: () => void;
};

type AlertFn = (
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
) => void;

type PendingAlert = {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
};

const AlertContext = createContext<AlertFn | null>(null);

export function useAppAlert(): AlertFn {
  const alert = useContext(AlertContext);
  if (!alert) {
    throw new Error('useAppAlert must be used within an AlertProvider');
  }
  return alert;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [pending, setPending] = useState<PendingAlert | null>(null);

  const show = useCallback<AlertFn>((title, message, buttons) => {
    setPending({
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: 'OK' }],
    });
  }, []);

  // Android back / dismiss acts like the cancel button, matching Alert.alert.
  const dismiss = useCallback(() => {
    setPending(prev => {
      prev?.buttons.find(button => button.style === 'cancel')?.onPress?.();
      return null;
    });
  }, []);

  const choose = (button: AppAlertButton) => {
    setPending(null);
    button.onPress?.();
  };

  return (
    <AlertContext.Provider value={show}>
      {children}
      <Modal
        transparent
        animationType="fade"
        visible={pending !== null}
        onRequestClose={dismiss}
      >
        <View style={styles.overlay}>
          <View style={styles.card} testID="app-alert">
            <Text style={styles.title}>{pending?.title}</Text>
            {pending?.message ? (
              <Text style={styles.message}>{pending.message}</Text>
            ) : null}
            <View style={styles.buttonRow}>
              {pending?.buttons.map(button => (
                <Pressable
                  key={button.text}
                  testID={`alert-button-${button.text}`}
                  accessibilityRole="button"
                  style={styles.button}
                  onPress={() => choose(button)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      button.style === 'destructive' && styles.destructiveText,
                      button.style === 'cancel' && styles.cancelText,
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 20,
      padding: 20,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      marginBottom: 8,
      color: theme.colors.textPrimary,
    },
    message: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 8,
    },
    button: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginLeft: 8,
    },
    buttonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.buttonPrimary,
    },
    cancelText: {
      color: theme.colors.textSecondary,
    },
    destructiveText: {
      color: theme.colors.danger,
    },
  });
}
