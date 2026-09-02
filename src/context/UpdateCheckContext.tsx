import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { useAppToast } from '../components/AppToast';
import {
  checkForUpdate,
  INSTALLED_VERSION,
  type LatestRelease,
} from '../services/updateCheck';
import { useLogs } from './LogsContext';

/**
 * Update Check outcome as the UI reads it (CONTEXT.md):
 * - checking: a check is in flight (also before the launch check returns)
 * - available: the last successful check found an Available Update
 * - up-to-date: the last successful check found none
 * - failed: no successful check yet and the last one failed
 */
export type UpdateCheckStatus =
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'failed';

type UpdateCheckValue = {
  /** Android only: iOS has no releases, so nothing is checked or shown. */
  enabled: boolean;
  status: UpdateCheckStatus;
  available: LatestRelease | null;
  /** Runs a check; ignored while one is in flight. Manual failures toast. */
  check: (options?: { manual: boolean }) => void;
};

const UpdateCheckContext = createContext<UpdateCheckValue | undefined>(
  undefined,
);

type Props = {
  children: React.ReactNode;
  /** Injected for tests. */
  enabled?: boolean;
  installedVersion?: string;
  fetchImpl?: typeof fetch;
};

export function UpdateCheckProvider({
  children,
  enabled = Platform.OS === 'android',
  installedVersion = INSTALLED_VERSION,
  fetchImpl,
}: Props) {
  const { debugLogs } = useLogs();
  const toast = useAppToast();
  const [checking, setChecking] = useState(enabled);
  // undefined = no successful check yet; null = up to date.
  const [answer, setAnswer] = useState<LatestRelease | null | undefined>();
  const inFlight = useRef(false);
  const launched = useRef(false);

  const check = useCallback(
    async ({ manual } = { manual: false }) => {
      if (!enabled || inFlight.current) {
        return;
      }
      inFlight.current = true;
      setChecking(true);
      const log = (message: string) =>
        debugLogs.append({
          at: new Date(),
          message: `Update Check: ${message}`,
        });
      log('started.');
      const result = await checkForUpdate(installedVersion, { fetchImpl });
      if (result.ok) {
        setAnswer(result.value);
        log(result.value ? `found ${result.value.version}.` : 'up to date.');
      } else {
        // A failed check keeps the previous answer.
        log(`failed: ${result.error}.`);
        if (manual) {
          toast("Couldn't check for updates");
        }
      }
      inFlight.current = false;
      setChecking(false);
    },
    [enabled, installedVersion, fetchImpl, debugLogs, toast],
  );

  // Once per cold start: the ref keeps a dependency change from re-checking.
  useEffect(() => {
    if (!launched.current) {
      launched.current = true;
      check();
    }
  }, [check]);

  const value = useMemo<UpdateCheckValue>(() => {
    const status: UpdateCheckStatus = checking
      ? 'checking'
      : answer
      ? 'available'
      : answer === null
      ? 'up-to-date'
      : 'failed';
    return { enabled, status, available: answer ?? null, check };
  }, [enabled, checking, answer, check]);

  return (
    <UpdateCheckContext.Provider value={value}>
      {children}
    </UpdateCheckContext.Provider>
  );
}

export function useUpdateCheck(): UpdateCheckValue {
  const value = useContext(UpdateCheckContext);
  if (!value) {
    throw new Error('useUpdateCheck must be used inside UpdateCheckProvider.');
  }
  return value;
}
