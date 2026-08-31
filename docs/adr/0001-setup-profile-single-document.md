---
status: superseded by 0003
---

# Setup Profile is one versioned document

The Setup Profile was spread across 11 flat AsyncStorage keys with six mirrored persist effects, no version, and two sources of truth for DNS servers. We now persist the whole profile as one JSON document under a single key with a `version` field; a one-shot migration builds the document from legacy keys on first load and then deletes them. Effective Rules (local + imported, merged) are derived on demand and never persisted — only the raw Imported Rules cache is stored — so a local edit is reflected immediately instead of going stale until an explicit save.

## Considered Options

- Keep per-field keys, add a facade — rejected: still N writes, still no atomic snapshot, still no versioning.
- Keep legacy keys as a permanent read fallback — rejected: doubles the read path forever for a one-time benefit.
- Compute Imported Rules from the legacy merged list on migration — rejected: lossy and extra test surface; Remote Rules URL survives, so users re-import once.

## Consequences

- Any future shape change bumps `version` and adds a migration step; there is no other way to evolve stored data.
- Corrupt or unknown-version documents fall back to the default profile with a warning; no backup copy is kept.
- First tunnel start after upgrade has no Imported Rules until the user re-imports.
