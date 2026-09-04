// Profile List + Selected Profile — one versioned document holding every
// Setup Profile and the selection pointer. See CONTEXT.md and ADR 0003.

import {
  applyProfileLink,
  defaultProfile,
  loadProfile,
  migrateProfileDocument,
  LEGACY_STORAGE_KEYS,
  PROFILE_STORAGE_KEY,
  type ProfileEnv,
  type ProfileLinkError,
  type ProfileStorage,
  type Result,
  type SetupProfile,
} from './setupProfile';

// Each entry keeps the ADR 0001 document shape (own `version` included) and
// gains an `id` plus a `name` mirrored from the server name (#89).
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

// Appending never steals the selection — editing and selecting are separate
// acts — except when nothing is selected yet.
function appendProfile(
  list: ProfileList,
  profile: SetupProfile,
  select: boolean,
): { list: ProfileList; id: string } {
  const entry: ProfileEntry = {
    ...profile,
    id: newProfileId(),
    name: profileName(profile),
  };
  return {
    list: {
      ...list,
      profiles: [...list.profiles, entry],
      selectedId:
        select || list.selectedId === null ? entry.id : list.selectedId,
    },
    id: entry.id,
  };
}

// Commits a Profile Draft (ADR 0005): appends it under its server name —
// the Profile's one and only name (#89); the Completeness gate guarantees
// one exists on this path.
export function createProfile(
  list: ProfileList,
  profile: SetupProfile,
): { list: ProfileList; id: string } {
  return appendProfile(list, profile, false);
}

// Profile Link rule (ADR 0003): always creates, never overwrites; selected
// only when the caller says the Display State is Stopped.
export function addFromProfileLink(
  list: ProfileList,
  link: string,
  env: ProfileEnv,
  select: boolean,
): Result<{ list: ProfileList; id: string }, ProfileLinkError> {
  const applied = applyProfileLink(defaultProfile(env), link);
  if (!applied.ok) {
    return applied;
  }
  return { ok: true, value: appendProfile(list, applied.value, select) };
}

export function selectProfile(list: ProfileList, id: string): ProfileList {
  if (!list.profiles.some(entry => entry.id === id)) {
    return list;
  }
  return { ...list, selectedId: id };
}

// Edits address a profile by id — the editor may be open on a profile that
// is not selected. The transform can rebuild the document; id and name stay.
export function updateEntry(
  list: ProfileList,
  id: string | null,
  transform: (profile: SetupProfile) => SetupProfile,
): ProfileList {
  const target = list.profiles.find(entry => entry.id === id);
  if (!target) {
    return list;
  }
  const next: ProfileEntry = {
    ...transform(target),
    id: target.id,
    name: target.name,
  };
  return {
    ...list,
    profiles: list.profiles.map(entry => (entry.id === id ? next : entry)),
  };
}

export function updateSelected(
  list: ProfileList,
  transform: (profile: SetupProfile) => SetupProfile,
): ProfileList {
  return updateEntry(list, list.selectedId, transform);
}

export function renameProfile(
  list: ProfileList,
  id: string,
  name: string,
): ProfileList {
  return {
    ...list,
    profiles: list.profiles.map(entry =>
      entry.id === id ? { ...entry, name } : entry,
    ),
  };
}

// Reselect-or-none: deleting the Selected Profile points at another profile
// or null, never at a ghost. Blocking while Running is the caller's rule —
// only the UI knows the Display State.
export function deleteProfile(list: ProfileList, id: string): ProfileList {
  if (!list.profiles.some(entry => entry.id === id)) {
    return list;
  }
  const profiles = list.profiles.filter(entry => entry.id !== id);
  const selectedId =
    list.selectedId === id ? profiles[0]?.id ?? null : list.selectedId;
  return { ...list, profiles, selectedId };
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
      // ponytail: trust the list shape; add field validation if corrupt docs
      // show up. Each entry carries its own document version (ADR 0003).
      return {
        ...parsed,
        profiles: (parsed.profiles as ProfileEntry[]).map(entry => ({
          ...entry,
          ...migrateProfileDocument(entry),
        })),
      } as ProfileList;
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
  const legacyKeys = [
    PROFILE_STORAGE_KEY,
    ...Object.values(LEGACY_STORAGE_KEYS),
  ];
  const values = await Promise.all(legacyKeys.map(key => storage.getItem(key)));
  if (values.every(value => value === null)) {
    return null; // fresh install — nothing to migrate
  }
  const list = wrapAsList(await loadProfile(storage, env));
  await saveProfileList(storage, list);
  await storage.multiRemove([PROFILE_STORAGE_KEY]);
  return list;
}
