// Setup Profile — single owner of the profile value, its intents,
// derivations, persistence and legacy migration. See CONTEXT.md and ADR 0001.

import type {
  AdvancedSettings,
  BypassDnsRoute,
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

/** Bypass DNS Source (v3, ADR 0007): where the Bypass DNS Servers come from. */
export type BypassDnsSource = 'same-as-tunnel' | 'custom';

export interface SetupProfile {
  version: 4;
  server: ServerCredentials;
  /** Tunnel DNS Servers (storage key kept from v1). */
  dnsServers: string[];
  /** Bypass DNS Source (v3): `same-as-tunnel` follows dnsServers live. */
  bypassDnsSource: BypassDnsSource;
  /** Bypass DNS Servers (v2); the custom list, read only under `custom`. Empty means the device's system resolvers. */
  bypassDnsServers: string[];
  /** Bypass DNS Route (v2, #117); meaningless while the list is empty. */
  bypassDnsRoute: BypassDnsRoute;
  routingMode: RoutingMode;
  localRulesText: string;
  remoteRulesURL: string;
  importedRules: string[];
  importedAt: string | null;
  /** Advanced Settings (v4, ADR 0008); JSON Mode is the only editor. */
  advanced: AdvancedSettings;
}

/** What the app hard-coded before v4; seed via `seedAdvanced()`, never by reference. */
export const DEFAULT_ADVANCED_SETTINGS: Readonly<AdvancedSettings> = {
  killSwitch: true,
  antiDpi: false,
  mtu: 1500,
  fallbackProtocol: null,
  excludedRoutes: [
    '10.0.0.0/8',
    '100.64.0.0/10',
    '169.254.0.0/16',
    '172.16.0.0/12',
    '192.0.0.0/24',
    '192.168.0.0/16',
    '255.255.255.255/32',
  ],
};

// Fresh copy per profile so no two documents share one routes array.
const seedAdvanced = (): AdvancedSettings => ({
  ...DEFAULT_ADVANCED_SETTINGS,
  excludedRoutes: [...DEFAULT_ADVANCED_SETTINGS.excludedRoutes],
});

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
  | 'port'
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
const BYPASS_DNS_ROUTES: BypassDnsRoute[] = ['direct', 'tunnel'];
const PROTOCOLS: VpnProtocol[] = ['Http/2', 'QUIC'];
const pick = <T extends string>(
  value: string | null | undefined,
  allowed: T[],
) => (allowed.includes(value as T) ? (value as T) : undefined);
// Profile Completeness checks, in report order (port sits with the address).
const COMPLETENESS_CHECKS: [MissingField, (s: ServerCredentials) => boolean][] =
  [
    ['name', s => isBlank(s.name)],
    ['ipAddress', s => isBlank(splitHostPort(s.ipAddress).host)],
    ['port', s => hasInvalidPort(s.ipAddress)],
    ['domain', s => isBlank(s.domain)],
    ['login', s => isBlank(s.login)],
    ['password', s => isBlank(s.password)],
  ];
const isBlank = (value: string) => value.trim().length === 0;
// A port present in the server address (`host[:port]`) must be an integer
// 1–65535; `host:` is 443.
// ponytail: one-colon form only; bracketed IPv6 is out of scope (#124)
const PORT_RE = /^([^:]*):([^:]*)$/;
function hasInvalidPort(ipAddress: string): boolean {
  const port = splitHostPort(ipAddress.trim()).port;
  if (port === '') return false;
  return !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535;
}

/** The Profile Form's two boxes over the one stored `host[:port]` (#126). */
export function splitHostPort(ipAddress: string): {
  host: string;
  port: string;
} {
  const match = ipAddress.match(PORT_RE);
  return match
    ? { host: match[1], port: match[2] }
    : { host: ipAddress, port: '' };
}

export function joinHostPort(host: string, port: string): string {
  return port ? `${host}:${port}` : host;
}

// --- intents ---------------------------------------------------------------

export function defaultProfile(env: ProfileEnv): SetupProfile {
  return {
    version: 4,
    server: {
      name: env.ENV_SERVER_NAME || '',
      ipAddress: '',
      domain: '',
      login: '',
      password: '',
      vpnProtocol: env.ENV_PROTOCOL || 'QUIC',
    },
    dnsServers: parseRules(env.ENV_DNS_SERVERS || ''),
    bypassDnsSource: 'same-as-tunnel',
    bypassDnsServers: [],
    bypassDnsRoute: 'tunnel',
    routingMode: 'selective',
    localRulesText: '',
    remoteRulesURL: '',
    importedRules: [],
    importedAt: null,
    advanced: seedAdvanced(),
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

// Profile Link: twohops://…?login=&password=&ip=&domain=&protocol=&dns=
//   &bypassDns=&bypassDnsRoute=&remoteRules=
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
  // A link carrying a list lands as a custom list; one without leaves the
  // source as it is (ADR 0007).
  const bypassDns = params.get('bypassDns');
  if (bypassDns !== undefined) {
    patch.bypassDnsSource = 'custom';
    patch.bypassDnsServers = parseRules(bypassDns);
  }
  const bypassDnsRoute = pick(params.get('bypassDnsRoute'), BYPASS_DNS_ROUTES);
  if (bypassDnsRoute !== undefined) patch.bypassDnsRoute = bypassDnsRoute;
  const remoteRules = params.get('remoteRules');
  if (remoteRules !== undefined) patch.remoteRulesURL = remoteRules;
  return {
    ok: true,
    value: updateProfile(updateServer(profile, server), patch),
  };
}

// Share Profile: the inverse of applyProfileLink. Carries exactly the link
// contract (no name, Routing Mode or Local Rules); empty fields are omitted.
// Under same-as-tunnel the bypass params are omitted so the recipient gets
// the same follow-live behaviour (ADR 0007).
// Password travels in clear — CONTEXT.md "Share Profile" accepts this.
export function profileLink(profile: SetupProfile): string {
  const { server } = profile;
  const bypassDnsServers =
    profile.bypassDnsSource === 'custom' ? profile.bypassDnsServers : [];
  const fields: [string, string][] = [
    ['login', server.login],
    ['password', server.password],
    ['ip', server.ipAddress],
    ['domain', server.domain],
    ['protocol', server.vpnProtocol],
    ['dns', profile.dnsServers.join(',')],
    ['bypassDns', bypassDnsServers.join(',')],
    // Route is meaningless without a carried list; omit it alongside.
    ['bypassDnsRoute', bypassDnsServers.length ? profile.bypassDnsRoute : ''],
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
  return COMPLETENESS_CHECKS.filter(([, fails]) => fails(profile.server)).map(
    ([field]) => field,
  );
}

/** The Bypass DNS Servers after applying the Bypass DNS Source (ADR 0007). */
export function resolvedBypassDnsServers(profile: SetupProfile): string[] {
  return profile.bypassDnsSource === 'same-as-tunnel'
    ? profile.dnsServers
    : profile.bypassDnsServers;
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
        // The core never sees the source; it gets the resolved list.
        bypassDnsServers: resolvedBypassDnsServers(profile),
        bypassDnsRoute: profile.bypassDnsRoute,
      },
      routing: { mode: profile.routingMode, rules: effectiveRules(profile) },
      advanced: profile.advanced,
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
// v1 -> v2: Bypass DNS Servers (empty) and Bypass DNS Route (direct) added
// (#116, #117). v2 shipped unreleased without the route, so it is defaulted
// on read too. v2 -> v3: Bypass DNS Source; absent means `custom`, so a
// stored profile keeps exactly what it had (ADR 0007). v3 -> v4: Advanced
// Settings, seeded with the constants the encoder used to hard-code (#132).
// ponytail: trust the known-version shape; add field validation if corrupt
// docs show up
export function migrateProfileDocument(parsed: unknown): SetupProfile {
  const doc = parsed as { version?: unknown } | null;
  switch (doc?.version) {
    case 1:
    case 2:
    case 3:
    case 4: {
      const partial = doc as Partial<SetupProfile>;
      return {
        ...partial,
        bypassDnsSource: partial.bypassDnsSource ?? 'custom',
        bypassDnsServers: partial.bypassDnsServers ?? [],
        bypassDnsRoute: partial.bypassDnsRoute ?? 'direct',
        advanced: partial.advanced ?? seedAdvanced(),
        version: 4,
      } as SetupProfile;
    }
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
    // An existing profile keeps its behaviour: system resolvers, direct.
    bypassDnsSource: 'custom',
    bypassDnsRoute: 'direct',
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
