---
status: accepted
---

# Fork TrustTunnelClient to own the Bypass-side resolver

TrustTunnel resolves Tunnel-side Queries with the profile's `dns_upstreams` through the tunnel, and Bypass-side Queries with the device's system resolvers, direct. The second half is not configurable: `start_system_dns_proxy` takes whatever the OS network reports. That leaves no way to filter ads or trackers for bypassed traffic, which in selective mode is most traffic, and no way to survive an ISP that blocks public resolvers, short of asking every user to change Android's Private DNS.

We fork `TrustTunnel/TrustTunnelClient` at `v1.1.5` and add two config keys beside `dns_upstreams`: `direct_dns_upstreams` (resolvers for Bypass-side Queries; empty keeps today's system-resolver behaviour) and `direct_dns_via_tunnel` (bool, default false; when true the Bypass-side resolver is reached through the tunnel, following the same tunnel-down fallback as `dns_upstreams`). The fork's AAR is built by GitHub Actions on the fork and published to that repository's GitHub Packages under our own group id, versioned `<upstream>-twohops.<n>`. TwoHops pins that artifact. No upstream PR for now; we rebase the fork onto upstream tags as they appear.

## Considered Options

- Ask users to set Android Private DNS — rejected: OS-wide, buried in system settings, and Private DNS to a public resolver dies on the same ISPs that block the resolver.
- Reflection into the adapter's private `vpnClient` to call `setSystemDnsServers` — rejected: overwritten on every `onLinkPropertiesChanged`, breaks on any AAR bump, and cannot route the resolver through the tunnel.
- Upstream PR first, fork only if stalled — rejected for now: upstream develops on internal Bamboo, external Android feature PRs have sat unreviewed since 2026-06, and waiting blocks the feature. Nothing stops a PR later.
- One resolver list for both sides — rejected: the two sides reach their resolver over different networks, so a single list cannot express "AdGuard via tunnel for included, AdGuard direct for excluded".
- Automatic direct-then-tunnel fallback — deferred: more core logic; the manual route toggle covers the known case.

## Consequences

- We own a native build: Python, CMake, Conan 2, Go, Ninja, NDK on a GitHub runner. First run is slow; Conan cache makes later runs tolerable. Local builds stay off by default.
- Every upstream release means a rebase and a re-publish. The patch touches roughly eleven files across core, trusttunnel, and both platform adapters, so conflicts are possible but small.
- The Kotlin adapter drops unknown TOML keys, so the new keys must be added to `VpnServiceConfig` or they silently vanish. The Swift adapter gets them as optionals so iOS keeps compiling.
- TwoHops' Gradle points at the fork's package repository; the package must be public for `GITHUB_TOKEN` in CI to read it.
- The Profile Link and Share Profile grow two parameters; old links without them leave the new fields empty.
- Out of scope, by decision: a DNS `reject` action for blocklists without an upstream filter, iOS, automatic fallback.
