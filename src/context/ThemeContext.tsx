import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppTheme, resolveColorScheme } from '../theme/colors';
import type { AppTheme, ThemePreference } from '../theme/colors';

const STORAGE_KEY_THEME_PREFERENCE = '@twohops/theme/preference';
const VALID_THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

type ThemeContextValue = {
  theme: AppTheme;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  isThemeHydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type ThemeProviderProps = {
  children: React.ReactNode;
};

function isThemePreference(value: string): value is ThemePreference {
  return VALID_THEME_PREFERENCES.includes(value as ThemePreference);
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>('system');
  const [isThemeHydrated, setIsThemeHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY_THEME_PREFERENCE)
      .then(value => {
        if (cancelled || !value || !isThemePreference(value)) {
          return;
        }
        setThemePreferenceState(value);
      })
      .catch(error => {
        console.error('Failed to load theme preference:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsThemeHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isThemeHydrated) {
      return;
    }

    AsyncStorage.setItem(STORAGE_KEY_THEME_PREFERENCE, themePreference).catch(
      error => {
        console.error('Failed to save theme preference:', error);
      },
    );
  }, [isThemeHydrated, themePreference]);

  const setThemePreference = useCallback((preference: ThemePreference) => {
    setThemePreferenceState(preference);
  }, []);

  const theme = useMemo(() => {
    const resolvedColorScheme = resolveColorScheme(
      themePreference,
      systemColorScheme,
    );

    return getAppTheme(resolvedColorScheme);
  }, [systemColorScheme, themePreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themePreference,
      setThemePreference,
      isThemeHydrated,
    }),
    [isThemeHydrated, setThemePreference, theme, themePreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useAppTheme must be used inside ThemeProvider.');
  }
  return value;
}
