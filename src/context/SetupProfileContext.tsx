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
  defaultProfile,
  type ProfileEnv,
  type ProfileLinkError,
  type ProfileStorage,
  type Result,
  type SetupProfile,
} from '../services/setupProfile';
import {
  addFromProfileLink as addFromProfileLinkIntent,
  createProfile as createProfileIntent,
  defaultProfileList,
  deleteProfile as deleteProfileIntent,
  loadProfileList,
  renameProfile as renameProfileIntent,
  saveProfileList,
  selectProfile as selectProfileIntent,
  selectedProfile,
  updateEntry,
  type ProfileEntry,
  type ProfileList,
} from '../services/profileStore';

type SetupProfileContextValue = {
  profiles: ProfileEntry[];
  selectedId: string | null;
  /** The Selected Profile — what the Dashboard shows and tunnel start reads. */
  profile: SetupProfile;
  isHydrated: boolean;
  selectProfile: (id: string) => void;
  /** Commits a Profile Draft to the Profile List; returns the new id. */
  createProfile: (profile: SetupProfile) => string;
  /** Creates a profile from a Profile Link; selects it when `select`. */
  addFromProfileLink: (
    link: string,
    select: boolean,
  ) => Result<{ id: string }, ProfileLinkError>;
  /** Commits an edit Draft back onto its entry; the entry name is the server name (#89). */
  saveProfile: (id: string, profile: SetupProfile) => void;
  deleteProfile: (id: string) => void;
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
  // Adds must hand the new id back synchronously (to open its editor), so
  // they compute from a ref mirroring the latest list instead of an updater,
  // which React defers.
  const listRef = useRef(list);
  listRef.current = list;
  const createProfile = useCallback((profile: SetupProfile) => {
    const result = createProfileIntent(listRef.current, profile);
    listRef.current = result.list;
    setList(result.list);
    return result.id;
  }, []);
  const addFromProfileLink = useCallback(
    (
      link: string,
      select: boolean,
    ): Result<{ id: string }, ProfileLinkError> => {
      const result = addFromProfileLinkIntent(
        listRef.current,
        link,
        env,
        select,
      );
      if (!result.ok) {
        return result;
      }
      listRef.current = result.value.list;
      setList(result.value.list);
      return { ok: true, value: { id: result.value.id } };
    },
    [],
  );
  const saveProfile = useCallback(
    (id: string, profile: SetupProfile) =>
      setList(prev =>
        renameProfileIntent(
          updateEntry(prev, id, () => profile),
          id,
          // Trimmed like createProfile; the gate only checks trimmed length.
          profile.server.name.trim(),
        ),
      ),
    [],
  );
  const deleteProfile = useCallback(
    (id: string) => setList(prev => deleteProfileIntent(prev, id)),
    [],
  );

  const value = useMemo(
    () => ({
      profiles: list.profiles,
      selectedId: list.selectedId,
      profile: selectedProfile(list) ?? defaultProfile(env),
      isHydrated,
      selectProfile,
      createProfile,
      addFromProfileLink,
      saveProfile,
      deleteProfile,
    }),
    [
      list,
      isHydrated,
      selectProfile,
      createProfile,
      addFromProfileLink,
      saveProfile,
      deleteProfile,
    ],
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
