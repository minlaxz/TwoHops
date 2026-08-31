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
  updateProfile as updateProfileIntent,
  updateServer as updateServerIntent,
  type ProfileEnv,
  type ProfileStorage,
  type ServerCredentials,
  type SetupProfile,
} from '../services/setupProfile';
import {
  defaultProfileList,
  loadProfileList,
  saveProfileList,
  selectProfile as selectProfileIntent,
  selectedProfile,
  updateSelected,
  type ProfileEntry,
  type ProfileList,
} from '../services/profileStore';

type SetupProfileContextValue = {
  profiles: ProfileEntry[];
  selectedId: string | null;
  /** The Selected Profile — what the editor edits and tunnel start reads. */
  profile: SetupProfile;
  isHydrated: boolean;
  selectProfile: (id: string) => void;
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
  const [list, setList] = useState<ProfileList>(() => defaultProfileList(env));
  const [isHydrated, setIsHydrated] = useState(false);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    loadProfileList(storage, env)
      .catch(error => {
        console.error('Failed to load Profile List:', error);
        return defaultProfileList(env);
      })
      .then(loaded => {
        if (cancelled) {
          return;
        }
        skipNextSave.current = true;
        setList(loaded);
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
    saveProfileList(storage, list).catch(error => {
      console.error('Failed to save Profile List:', error);
    });
  }, [isHydrated, list, storage]);

  const selectProfile = useCallback(
    (id: string) => setList(prev => selectProfileIntent(prev, id)),
    [],
  );
  const updateProfile = useCallback(
    (patch: Partial<Omit<SetupProfile, 'version'>>) =>
      setList(prev =>
        updateSelected(prev, profile => updateProfileIntent(profile, patch)),
      ),
    [],
  );
  const updateServer = useCallback(
    (patch: Partial<ServerCredentials>) =>
      setList(prev =>
        updateSelected(prev, profile => updateServerIntent(profile, patch)),
      ),
    [],
  );
  // Persist effect writes the defaults; nothing else to remove.
  const clearProfile = useCallback(
    () => setList(prev => updateSelected(prev, () => clearProfileIntent(env))),
    [],
  );

  const value = useMemo(
    () => ({
      profiles: list.profiles,
      selectedId: list.selectedId,
      profile: selectedProfile(list) ?? defaultProfile(env),
      isHydrated,
      selectProfile,
      updateProfile,
      updateServer,
      clearProfile,
    }),
    [list, isHydrated, selectProfile, updateProfile, updateServer, clearProfile],
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
