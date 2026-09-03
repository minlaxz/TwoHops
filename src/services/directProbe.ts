// Direct Probe (#99): does a bypassed domain actually answer when reached
// direct? The core gives no failure signal for bypass connections (see
// docs/research/bypass-block-detection.md), so an on-demand active probe is
// the only app-side detection that does not guess. Never run automatically.
//
// Path: in selective mode the core routes a non-listed domain direct, so the
// probe takes the same path the browser did. Whether the AAR also excludes
// this package from the TUN is not verifiable from the app (the Tun config
// exposes no app-exclusion field); if it does, the probe goes direct without
// the core, and the verdict is the same.

export const DIRECT_PROBE_TIMEOUT_MS = 5000;

export type ProbeResult = 'works' | 'failed';

/**
 * HEAD https://<domain>. Any HTTP status means the path is open ("works");
 * connection reset, DNS failure or timeout means "failed".
 *
 * ponytail: DPI that answers with a fake 200 / redirect page passes as
 * "works". SNI-based RST, timeouts and DNS poisoning are caught.
 */
export async function probeDirect(
  domain: string,
  {
    fetchImpl = fetch,
    timeoutMs = DIRECT_PROBE_TIMEOUT_MS,
  }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetchImpl(`https://${domain}/`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return 'works';
  } catch {
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}
