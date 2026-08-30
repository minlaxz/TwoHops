// Routing Rules — single owner of rule parsing, merging, serialising and
// wildcard expansion. See CONTEXT.md ("Routing Rule").

const WILDCARD_PREFIX = '*.';

/** Split rule text on any mix of commas / newlines / CRLF; trim; drop empties. */
export function parseRules(raw: string): string[] {
  return raw
    .split(/[,\r\n]+/)
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);
}

/** Local first, then remote; deduplicated; insertion order preserved. */
export function mergeRules(local: string[], remote: string[]): string[] {
  return [...new Set([...local, ...remote])];
}

/** Canonical stored form: newline-joined. */
export function serializeRules(rules: string[]): string {
  return rules.join('\n');
}

/**
 * Expand domain-like rules to include their wildcard form.
 * Addresses / CIDRs come first, untouched; then domains + `*.domain`.
 */
export function expandRules(rules: string[]): string[] {
  const domains = new Set<string>();
  const addresses = new Set<string>();

  for (const rule of rules) {
    const normalized = rule.trim();
    if (!normalized) {
      continue;
    }
    if (isDomainLike(normalized)) {
      domains.add(normalized);
      if (!normalized.startsWith(WILDCARD_PREFIX)) {
        domains.add(`${WILDCARD_PREFIX}${normalized}`);
      }
    } else {
      addresses.add(normalized);
    }
  }

  return [...addresses, ...domains];
}

function isDomainLike(value: string): boolean {
  if (value.startsWith('[') || value.includes('/') || value.includes(':')) {
    return false;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return false; // bare IPv4
  }
  return value.includes('.') && !value.includes(' ');
}

/** Fetch and parse a remote rules file. Throws on non-OK or network error. */
export async function fetchRemoteRules(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch routing rules: ${response.statusText}`);
  }
  return parseRules(await response.text());
}
