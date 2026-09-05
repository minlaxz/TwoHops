import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CORE_LOG_LEVELS, type CoreLogLevel } from '../services/coreLog';

const STORAGE_KEY_LOG_SETTINGS = '@twohops/logs/settings';

/** Debug / Traffic / Core Logging (glossary terms): all OFF by default;
 * Core Log Level defaults to info (issue #136). */
type LogSettings = {
  debugLoggingEnabled: boolean;
  trafficLoggingEnabled: boolean;
  coreLoggingEnabled: boolean;
  coreLogLevel: CoreLogLevel;
};

const DEFAULT_SETTINGS: LogSettings = {
  debugLoggingEnabled: false,
  trafficLoggingEnabled: false,
  coreLoggingEnabled: false,
  coreLogLevel: 'info',
};

type LogSettingsContextValue = LogSettings & {
  setDebugLoggingEnabled: (enabled: boolean) => void;
  setTrafficLoggingEnabled: (enabled: boolean) => void;
  setCoreLoggingEnabled: (enabled: boolean) => void;
  setCoreLogLevel: (level: CoreLogLevel) => void;
};

const LogSettingsContext = createContext<LogSettingsContextValue | undefined>(
  undefined,
);

function parseSettings(raw: string): LogSettings {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_SETTINGS;
    }
    const record = parsed as Record<string, unknown>;
    return {
      debugLoggingEnabled: record.debugLoggingEnabled === true,
      trafficLoggingEnabled: record.trafficLoggingEnabled === true,
      coreLoggingEnabled: record.coreLoggingEnabled === true,
      coreLogLevel: CORE_LOG_LEVELS.includes(
        record.coreLogLevel as CoreLogLevel,
      )
        ? (record.coreLogLevel as CoreLogLevel)
        : 'info',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function LogSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<LogSettings>(DEFAULT_SETTINGS);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY_LOG_SETTINGS)
      .then(value => {
        if (!cancelled && value) {
          setSettings(parseSettings(value));
        }
      })
      .catch(error => {
        console.error('Failed to load log settings:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydrated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    AsyncStorage.setItem(
      STORAGE_KEY_LOG_SETTINGS,
      JSON.stringify(settings),
    ).catch(error => {
      console.error('Failed to save log settings:', error);
    });
  }, [isHydrated, settings]);

  const setDebugLoggingEnabled = useCallback((enabled: boolean) => {
    setSettings(current => ({ ...current, debugLoggingEnabled: enabled }));
  }, []);
  const setTrafficLoggingEnabled = useCallback((enabled: boolean) => {
    setSettings(current => ({ ...current, trafficLoggingEnabled: enabled }));
  }, []);

  const setCoreLoggingEnabled = useCallback((enabled: boolean) => {
    setSettings(current => ({ ...current, coreLoggingEnabled: enabled }));
  }, []);
  const setCoreLogLevel = useCallback((level: CoreLogLevel) => {
    setSettings(current => ({ ...current, coreLogLevel: level }));
  }, []);

  const value = useMemo<LogSettingsContextValue>(
    () => ({
      ...settings,
      setDebugLoggingEnabled,
      setTrafficLoggingEnabled,
      setCoreLoggingEnabled,
      setCoreLogLevel,
    }),
    [
      settings,
      setDebugLoggingEnabled,
      setTrafficLoggingEnabled,
      setCoreLoggingEnabled,
      setCoreLogLevel,
    ],
  );

  return (
    <LogSettingsContext.Provider value={value}>
      {children}
    </LogSettingsContext.Provider>
  );
}

export function useLogSettings(): LogSettingsContextValue {
  const value = useContext(LogSettingsContext);
  if (!value) {
    throw new Error('useLogSettings must be used inside LogSettingsProvider.');
  }
  return value;
}
