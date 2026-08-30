import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import {
  clearProfile as clearProfileIntent,
  defaultProfile,
  loadProfile,
  saveProfile,
  updateProfile as updateProfileIntent,
  updateServer as updateServerIntent,
  type ProfileEnv,
  type ProfileStorage,
  type ServerCredentials,
  type SetupProfile,
} from '../services/setupProfile';

type SetupProfileContextValue = {
  profile: SetupProfile;
  isHydrated: boolean;
  updateProfile: (patch: Partial<Omit<SetupProfile, 'version'>>) => void;
  updateServer: (patch: Partial<ServerCredentials>) => void;
  clearProfile: () => void;
};

const env: ProfileEnv = Config as ProfileEnv;

const SetupProfileContext = createContext<SetupProfileContextValue | undefined>(
  undefined,
);

type Props = {
  children: React.ReactNode;
  /** Injected for tests; defaults to AsyncStorage. */
  storage?: ProfileStorage;
};

export function SetupProfileProvider({
  children,
  storage = AsyncStorage,
}: Props) {
  const [profile, setProfile] = useState<SetupProfile>(() =>
    defaultProfile(env),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    loadProfile(storage, env)
      .catch(error => {
        console.error('Failed to load Setup Profile:', error);
        return defaultProfile(env);
      })
      .then(loaded => {
        if (cancelled) {
          return;
        }
        skipNextSave.current = true;
        setProfile(loaded);
        setIsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    if (skipNextSave.current) {
      skipNextSave.current = false; // the hydrated value is already on disk
      return;
    }
    saveProfile(storage, profile).catch(error => {
      console.error('Failed to save Setup Profile:', error);
    });
  }, [isHydrated, profile, storage]);

  const updateProfile = useCallback(
    (patch: Partial<Omit<SetupProfile, 'version'>>) =>
      setProfile(prev => updateProfileIntent(prev, patch)),
    [],
  );
  const updateServer = useCallback(
    (patch: Partial<ServerCredentials>) =>
      setProfile(prev => updateServerIntent(prev, patch)),
    [],
  );
  // Persist effect writes the defaults; nothing else to remove.
  const clearProfile = useCallback(
    () => setProfile(clearProfileIntent(env)),
    [],
  );

  const value = useMemo(
    () => ({ profile, isHydrated, updateProfile, updateServer, clearProfile }),
    [profile, isHydrated, updateProfile, updateServer, clearProfile],
  );

  return (
    <SetupProfileContext.Provider value={value}>
      {children}
    </SetupProfileContext.Provider>
  );
}

export function useSetupProfile(): SetupProfileContextValue {
  const value = useContext(SetupProfileContext);
  if (!value) {
    throw new Error(
      'useSetupProfile must be used inside SetupProfileProvider.',
    );
  }
  return value;
}
