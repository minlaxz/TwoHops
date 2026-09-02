import type { Result } from './setupProfile';

/** Latest Release (see CONTEXT.md): version and release page. */
export type LatestRelease = { version: string; url: string };

// ponytail: package.json is this repo's release version source of truth;
// switch to react-native-device-info if native build numbers ever diverge.
export const INSTALLED_VERSION: string = require('../../package.json').version;

export const LATEST_RELEASE_URL =
  'https://api.github.com/repos/minlaxz/TwoHops/releases/latest';
export const UPDATE_CHECK_TIMEOUT_MS = 10_000;

type Semver = [number, number, number];

// Tags are `v<major>.<minor>.<patch>` followed by an optional build stamp
// after `+` (older releases) or `-` (from 68a2bb6 on). The stamp is ignored.
const TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)(?:[+-].*)?$/;

/** Parses a release tag to its version; null when the tag is unparseable. */
export function parseReleaseTag(tag: string): string | null {
  const match = TAG_PATTERN.exec(tag);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

function toSemver(version: string): Semver | null {
  const parts = version.split('.');
  if (parts.length !== 3 || parts.some(part => !/^\d+$/.test(part))) {
    return null;
  }
  return parts.map(Number) as Semver;
}

/** Negative when a < b, zero when equal, positive when a > b. */
export function compareVersions(a: string, b: string): number {
  const left = toSemver(a);
  const right = toSemver(b);
  if (!left || !right) {
    throw new Error(`Not a semver: ${left ? b : a}`);
  }
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) {
      return left[i] - right[i];
    }
  }
  return 0;
}

/**
 * One Update Check: asks GitHub for the Latest Release. Resolves with the
 * Available Update (release newer than `installedVersion`) or null when up
 * to date. Any failure — network, timeout, bad status, unparseable tag —
 * is a result error, never a throw.
 */
export async function checkForUpdate(
  installedVersion: string,
  {
    fetchImpl = fetch,
    timeoutMs = UPDATE_CHECK_TIMEOUT_MS,
  }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<Result<LatestRelease | null, string>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(LATEST_RELEASE_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    const body: { tag_name?: unknown; html_url?: unknown } =
      await response.json();
    const tag = typeof body.tag_name === 'string' ? body.tag_name : '';
    const version = parseReleaseTag(tag);
    if (!version || typeof body.html_url !== 'string') {
      return { ok: false, error: `unparseable release: ${tag || '(none)'}` };
    }
    const newer = compareVersions(version, installedVersion) > 0;
    return { ok: true, value: newer ? { version, url: body.html_url } : null };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'timeout'
        : error instanceof Error
        ? error.message
        : String(error);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}
