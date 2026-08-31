// Profile List + Selected Profile — one versioned document holding every
// Setup Profile and the selection pointer. See CONTEXT.md and ADR 0003.

import {
  defaultProfile,
  loadProfile,
  LEGACY_STORAGE_KEYS,
  PROFILE_STORAGE_KEY,
  type ProfileEnv,
  type ProfileStorage,
  type SetupProfile,
} from './setupProfile';

// Each entry keeps the ADR 0001 document shape (own `version` included) and
// gains an `id` plus a user-editable `name`.
export type ProfileEntry = SetupProfile & { id: string; name: string };

export interface ProfileList {
  version: 1;
  profiles: ProfileEntry[];
  selectedId: string | null;
}

export const PROFILES_STORAGE_KEY = '@twohops/setup/profiles';

// ponytail: timestamp+random suffices for a local, low-volume id space
const newProfileId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const profileName = (profile: SetupProfile) =>
  profile.server.name.trim() || 'Profile 1';

function wrapAsList(profile: SetupProfile): ProfileList {
  const entry: ProfileEntry = {
    ...profile,
    id: newProfileId(),
    name: profileName(profile),
  };
  return { version: 1, profiles: [entry], selectedId: entry.id };
}

// --- intents ---------------------------------------------------------------

// ponytail: fresh installs seed one default Profile so the editor always has
// a Selected Profile; the ADR 0003 empty-list state ships with per-profile CRUD
export function defaultProfileList(env: ProfileEnv): ProfileList {
  return wrapAsList(defaultProfile(env));
}

export function selectProfile(list: ProfileList, id: string): ProfileList {
  if (!list.profiles.some(entry => entry.id === id)) {
    return list;
  }
  return { ...list, selectedId: id };
}

export function updateSelected(
  list: ProfileList,
  transform: (profile: SetupProfile) => SetupProfile,
): ProfileList {
  const selected = selectedProfile(list);
  if (!selected) {
    return list;
  }
  const next: ProfileEntry = {
    ...transform(selected),
    id: selected.id,
    name: selected.name,
  };
  return {
    ...list,
    profiles: list.profiles.map(entry =>
      entry.id === selected.id ? next : entry,
    ),
  };
}

// --- derivations -----------------------------------------------------------

export function selectedProfile(list: ProfileList): ProfileEntry | null {
  return list.profiles.find(entry => entry.id === list.selectedId) ?? null;
}

// --- persistence -----------------------------------------------------------

export async function saveProfileList(
  storage: ProfileStorage,
  list: ProfileList,
): Promise<void> {
  await storage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(list));
}

export async function loadProfileList(
  storage: ProfileStorage,
  env: ProfileEnv,
): Promise<ProfileList> {
  const raw = await storage.getItem(PROFILES_STORAGE_KEY);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1) {
        throw new Error(`unknown version ${parsed?.version}`);
      }
      // ponytail: trust v1 shape; add field validation if corrupt docs show up
      return parsed as ProfileList;
    } catch (error) {
      console.warn('Profile List unreadable, using defaults:', error);
      return defaultProfileList(env);
    }
  }
  return (await migrateSingleDocument(storage, env)) ?? defaultProfileList(env);
}

// One-shot migration: wrap the ADR 0001 single document (or, chained through
// loadProfile, the pre-ADR-0001 multi-key layout) as the first Profile,
// select it, delete the old key.
async function migrateSingleDocument(
  storage: ProfileStorage,
  env: ProfileEnv,
): Promise<ProfileList | null> {
  const legacyKeys = [PROFILE_STORAGE_KEY, ...Object.values(LEGACY_STORAGE_KEYS)];
  const values = await Promise.all(legacyKeys.map(key => storage.getItem(key)));
  if (values.every(value => value === null)) {
    return null; // fresh install — nothing to migrate
  }
  const list = wrapAsList(await loadProfile(storage, env));
  await saveProfileList(storage, list);
  await storage.multiRemove([PROFILE_STORAGE_KEY]);
  return list;
}
