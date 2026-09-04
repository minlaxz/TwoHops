// Setup Profile — single owner of the profile value, its intents,
// derivations, persistence and legacy migration. See CONTEXT.md and ADR 0001.

import type {
  RoutingMode,
  ServerCredentials,
  VpnProtocol,
  VpnStartInput,
} from '../types';
import {
  fetchRemoteRules,
  isDomainLike,
  mergeRules,
  parseRules,
  registrableDomain,
  serializeRules,
} from './routingRules';
import type { QueryLogRow } from '../types';

export type { ServerCredentials };

export interface SetupProfile {
  version: 2;
  server: ServerCredentials;
  /** Tunnel DNS Servers (storage key kept from v1). */
  dnsServers: string[];
  /** Bypass DNS Servers (v2); empty means the device's system resolvers. */
  bypassDnsServers: string[];
  routingMode: RoutingMode;
  localRulesText: string;
  remoteRulesURL: string;
  importedRules: string[];
  importedAt: string | null;
}

export type ProfileEnv = {
  ENV_SERVER_NAME?: string;
  ENV_PROTOCOL?: VpnProtocol;
  ENV_DNS_SERVERS?: string;
};

export interface ProfileStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export type MissingField =
  | 'name'
  | 'ipAddress'
  | 'domain'
  | 'login'
  | 'password';

export type StartError = { kind: 'incomplete'; missing: MissingField[] };

export type ProfileLinkError = { kind: 'scheme' } | { kind: 'malformed' };

export function profileLinkErrorMessage(error: ProfileLinkError): string {
  return error.kind === 'scheme'
    ? 'Link must start with twohops://'
    : 'Link is not a valid URL.';
}

export type ImportError =
  | { kind: 'noURL' }
  | { kind: 'fetch'; message: string };

export const PROFILE_STORAGE_KEY = '@twohops/setup/profile';

export const LEGACY_STORAGE_KEYS = {
  serverName: '@twohops/setup/server/name',
  serverIpAddress: '@twohops/setup/server/ipAddress',
  serverDomain: '@twohops/setup/server/domain',
  serverLogin: '@twohops/setup/server/login',
  serverPassword: '@twohops/setup/server/password',
  serverVpnProtocol: '@twohops/setup/server/vpnProtocol',
  routingMode: '@twohops/setup/routing/mode',
  dnsServersText: '@twohops/setup/dns/serversText',
  localRoutingRulesText: '@twohops/setup/routing/localRulesText',
  remoteRoutingURL: '@twohops/setup/routing/remoteRulesURL',
  rulesText: '@twohops/setup/routing/mergedRulesText',
} as const;

const ROUTING_MODES: RoutingMode[] = ['general', 'selective'];
const PROTOCOLS: VpnProtocol[] = ['Http/2', 'QUIC'];
const pick = <T extends string>(
  value: string | null | undefined,
  allowed: T[],
) => (allowed.includes(value as T) ? (value as T) : undefined);
const REQUIRED_FIELDS: MissingField[] = [
  'name',
  'ipAddress',
  'domain',
  'login',
  'password',
];

// --- intents ---------------------------------------------------------------

export function defaultProfile(env: ProfileEnv): SetupProfile {
  return {
    version: 2,
    server: {
      name: env.ENV_SERVER_NAME || '',
      ipAddress: '',
      domain: '',
      login: '',
      password: '',
      vpnProtocol: env.ENV_PROTOCOL || 'QUIC',
    },
    dnsServers: parseRules(env.ENV_DNS_SERVERS || ''),
    bypassDnsServers: [],
    routingMode: 'selective',
    localRulesText: '',
    remoteRulesURL: '',
    importedRules: [],
    importedAt: null,
  };
}

export const clearProfile = defaultProfile;

export function updateProfile(
  profile: SetupProfile,
  patch: Partial<Omit<SetupProfile, 'version'>>,
): SetupProfile {
  return { ...profile, ...patch };
}

export function updateServer(
  profile: SetupProfile,
  patch: Partial<ServerCredentials>,
): SetupProfile {
  return { ...profile, server: { ...profile.server, ...patch } };
}

// Profile Link: twohops://…?login=&password=&ip=&domain=&protocol=&dns=&remoteRules=
// Overwrites only the fields the link carries; a link cannot carry the server
// name, so an empty one defaults from the link's domain (user can overwrite).
// Pure — no network.
// ponytail: hand parser; RN's URLSearchParams lacks get(), and this is 15 lines.
export function applyProfileLink(
  profile: SetupProfile,
  link: string,
): Result<SetupProfile, ProfileLinkError> {
  const match = link
    .trim()
    .match(/^([a-z][a-z\d+\-.]*):(?:[^?#]*)(?:\?([^#]*))?/i);
  if (!match) {
    return { ok: false, error: { kind: 'malformed' } };
  }
  if (match[1].toLowerCase() !== 'twohops') {
    return { ok: false, error: { kind: 'scheme' } };
  }
  const params = new Map<string, string>();
  try {
    for (const pair of (match[2] ?? '').split('&')) {
      if (!pair) continue;
      const [key, ...rest] = pair.split('=');
      params.set(decodeURIComponent(key), decodeURIComponent(rest.join('=')));
    }
  } catch {
    return { ok: false, error: { kind: 'malformed' } };
  }
  const server: Partial<ServerCredentials> = {};
  const textParams: Record<
    string,
    keyof Omit<ServerCredentials, 'vpnProtocol'>
  > = {
    login: 'login',
    password: 'password',
    ip: 'ipAddress',
    domain: 'domain',
  };
  for (const [key, field] of Object.entries(textParams)) {
    const value = params.get(key);
    if (value !== undefined) server[field] = value;
  }
  const protocol = pick(params.get('protocol'), PROTOCOLS);
  if (protocol !== undefined) server.vpnProtocol = protocol;
  if (profile.server.name.trim() === '' && server.domain) {
    server.name = server.domain;
  }
  const patch: Partial<SetupProfile> = {};
  const dns = params.get('dns');
  if (dns !== undefined) patch.dnsServers = parseRules(dns);
  const remoteRules = params.get('remoteRules');
  if (remoteRules !== undefined) patch.remoteRulesURL = remoteRules;
  return {
    ok: true,
    value: updateProfile(updateServer(profile, server), patch),
  };
}

// Share Profile: the inverse of applyProfileLink. Carries exactly the link
// contract (no name, Routing Mode or Local Rules); empty fields are omitted.
// Password travels in clear — CONTEXT.md "Share Profile" accepts this.
export function profileLink(profile: SetupProfile): string {
  const { server } = profile;
  const fields: [string, string][] = [
    ['login', server.login],
    ['password', server.password],
    ['ip', server.ipAddress],
    ['domain', server.domain],
    ['protocol', server.vpnProtocol],
    ['dns', profile.dnsServers.join(',')],
    ['remoteRules', profile.remoteRulesURL],
  ];
  const query = fields
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `twohops://?${query}`;
}

// Remote Rules import: fetch the Remote Rules URL into the Imported Rules
// cache. Network is injected. Failure leaves the profile (and the previous
// Imported Rules) untouched; the error is transient UI state, never persisted.
export async function importRemoteRules(
  profile: SetupProfile,
  fetchImpl: typeof fetch = fetch,
): Promise<Result<SetupProfile, ImportError>> {
  const url = profile.remoteRulesURL.trim();
  if (!url) {
    return { ok: false, error: { kind: 'noURL' } };
  }
  try {
    const importedRules = await fetchRemoteRules(url, fetchImpl);
    return {
      ok: true,
      value: updateProfile(profile, {
        importedRules,
        importedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { kind: 'fetch', message } };
  }
}

// --- derivations -----------------------------------------------------------

export function effectiveRules(profile: SetupProfile): string[] {
  return mergeRules(parseRules(profile.localRulesText), profile.importedRules);
}

/** True when `rule` is already in the Effective Rules (local or imported). */
// `example.com` and `*.example.com` are one family to `expandRules`, so they
// are one family here too; case-insensitive like DNS.
const ruleKey = (rule: string) => rule.toLowerCase().replace(/^\*\./, '');

export function hasEffectiveRule(profile: SetupProfile, rule: string): boolean {
  const key = ruleKey(rule);
  return effectiveRules(profile).some(entry => ruleKey(entry) === key);
}

/** Appends `rule` to the Local Rules; returns the same profile when it is
 * already effective (#98). */
export function addLocalRule(
  profile: SetupProfile,
  rule: string,
): SetupProfile {
  if (hasEffectiveRule(profile, rule)) {
    return profile;
  }
  return updateProfile(profile, {
    localRulesText: serializeRules([
      ...parseRules(profile.localRulesText),
      rule,
    ]),
  });
}

/**
 * The Local Rule a Traffic Log row can offer to add (#98), or null. Only a
 * `bypass` row in `selective` mode (in `general` mode bypass rows are
 * exclusions; adding them is the wrong direction), with a hostname not yet
 * in the Effective Rules.
 */
export function offerableLocalRule(
  profile: SetupProfile,
  row: Pick<QueryLogRow, 'action' | 'domain'>,
): string | null {
  if (profile.routingMode !== 'selective' || row.action !== 'bypass') {
    return null;
  }
  const domain = row.domain?.trim().replace(/\.$/, '') ?? '';
  if (!isDomainLike(domain)) {
    return null;
  }
  const rule = registrableDomain(domain);
  return hasEffectiveRule(profile, rule) ? null : rule;
}

// What the Dashboard card and Profile Picker show under the name (#90):
// `domain · protocol`; an empty domain falls back to the IP address, and a
// Profile with neither reads Incomplete.
export function profileSubtitle({ server }: SetupProfile): string {
  const host = server.domain || server.ipAddress;
  return host ? `${host} · ${server.vpnProtocol}` : 'Incomplete';
}

export function missingFields(profile: SetupProfile): MissingField[] {
  return REQUIRED_FIELDS.filter(
    field => profile.server[field].trim().length === 0,
  );
}

export function tunnelStartInput(
  profile: SetupProfile,
): Result<VpnStartInput, StartError> {
  const missing = missingFields(profile);
  if (missing.length > 0) {
    return { ok: false, error: { kind: 'incomplete', missing } };
  }
  return {
    ok: true,
    value: {
      server: {
        ...profile.server,
        dnsServers: profile.dnsServers,
        bypassDnsServers: profile.bypassDnsServers,
      },
      routing: { mode: profile.routingMode, rules: effectiveRules(profile) },
    },
  };
}

// --- persistence -----------------------------------------------------------

export async function saveProfile(
  storage: ProfileStorage,
  profile: SetupProfile,
): Promise<void> {
  await storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export async function loadProfile(
  storage: ProfileStorage,
  env: ProfileEnv,
): Promise<SetupProfile> {
  const raw = await storage.getItem(PROFILE_STORAGE_KEY);
  if (raw === null) {
    return (await migrateLegacy(storage, env)) ?? defaultProfile(env);
  }
  try {
    return migrateProfileDocument(JSON.parse(raw));
  } catch (error) {
    console.warn('Setup Profile unreadable, using defaults:', error);
    return defaultProfile(env);
  }
}

// Per-document migration (ADR 0001; per entry inside the list, ADR 0003).
// v1 -> v2: Bypass DNS Servers added, default empty (#116).
// ponytail: trust the known-version shape; add field validation if corrupt
// docs show up
export function migrateProfileDocument(parsed: unknown): SetupProfile {
  const doc = parsed as { version?: unknown } | null;
  switch (doc?.version) {
    case 1:
      return {
        ...(doc as Omit<SetupProfile, 'version' | 'bypassDnsServers'>),
        bypassDnsServers: [],
        version: 2,
      };
    case 2:
      return doc as SetupProfile;
    default:
      throw new Error(`unknown version ${doc?.version}`);
  }
}

async function migrateLegacy(
  storage: ProfileStorage,
  env: ProfileEnv,
): Promise<SetupProfile | null> {
  const keys: string[] = Object.values(LEGACY_STORAGE_KEYS);
  const values = await Promise.all(keys.map(key => storage.getItem(key)));
  if (values.every(value => value === null)) {
    return null;
  }
  const get = (key: string) => values[keys.indexOf(key)];
  const base = defaultProfile(env);
  const profile: SetupProfile = {
    ...base,
    server: {
      name: get(LEGACY_STORAGE_KEYS.serverName) || base.server.name,
      ipAddress: get(LEGACY_STORAGE_KEYS.serverIpAddress) ?? '',
      domain: get(LEGACY_STORAGE_KEYS.serverDomain) ?? '',
      login: get(LEGACY_STORAGE_KEYS.serverLogin) ?? '',
      password: get(LEGACY_STORAGE_KEYS.serverPassword) ?? '',
      vpnProtocol:
        pick(get(LEGACY_STORAGE_KEYS.serverVpnProtocol), PROTOCOLS) ??
        base.server.vpnProtocol,
    },
    dnsServers: parseRules(
      get(LEGACY_STORAGE_KEYS.dnsServersText) ?? base.dnsServers.join(','),
    ),
    routingMode:
      pick(get(LEGACY_STORAGE_KEYS.routingMode), ROUTING_MODES) ??
      base.routingMode,
    localRulesText: get(LEGACY_STORAGE_KEYS.localRoutingRulesText) ?? '',
    remoteRulesURL: get(LEGACY_STORAGE_KEYS.remoteRoutingURL) ?? '',
  };
  await saveProfile(storage, profile);
  await storage.multiRemove(keys);
  return profile;
}
