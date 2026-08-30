# TrustTunnel client library: 0.99.64 -> latest (research, 2026-08-30)

> **Applied:** bump + `dns_upstreams` move landed in the same branch as this doc (issue #31). References to `0.99.64` / `configEncoder.ts:213` below describe pre-upgrade state.

Scope: `com.adguard.trusttunnel:trusttunnel-client-android` (pinned at
`android/app/build.gradle:144` as `0.99.64`) against the newest stable release of
[TrustTunnel/TrustTunnelClient](https://github.com/TrustTunnel/TrustTunnelClient).
All claims below come from the upstream git history / CHANGELOG / GitHub Packages page,
cloned and diffed locally; commit SHAs are given so they can be re-checked.

## 1. TL;DR

- **Latest stable git tag: `v1.1.4`** (2026-05-22, commit `7da863b1b947d22a3131d94dcc7c80b0240b6e97`).
  **Latest stable Maven artifact actually published: `1.1.3`** (2026-05-12). There is no `1.1.4`
  package on GitHub Packages, and there is no `v1.1.3` git tag. The Android adapter code is
  identical between the two (1.1.4's CHANGELOG entry is Linux-only), so **upgrade target = `1.1.3`**.
- Everything newer (`1.1.5-beta.1` ... `1.1.5-rc.6`, 2026-06-04 to 2026-08-21) is pre-release.
- **Breaking changes affecting TwoHops: 1** (config-format change in the Android adapter).
  Plus 3 behavioural changes worth knowing about, none of which require code changes.
- The Kotlin API that TwoHops calls (`VpnService.start/stop/startNetworkManager/setAppNotifier`,
  `AppNotifier`, `VpnPrepareActivity`, `VpnState` codes) is **signature-compatible** with 1.1.3/1.1.4.
- **Recommended upgrade path**
  1. In `src/services/configEncoder.ts`, move `dns_upstreams = ...` (currently line 213, in the
     root section) into the `[endpoint]` section (line 216+). Core accepts both; the Android
     adapter only reads `[endpoint].dns_upstreams` since 1.0.45.
  2. Bump `android/app/build.gradle:144` to `1.1.3`.
  3. (Optional) delete the `NetworkManagerState` guard at `NativeTrustTunnelModule.kt:139-149`;
     `startNetworkManager` is idempotent upstream now.
  4. Do NOT jump to `1.1.5-*` yet: it adds a required-ish `VpnService.initialize(context)` and a
     logging rework (see section 4).

## 2. Version timeline 0.99.64 -> latest

Sources: `gh api repos/TrustTunnel/TrustTunnelClient/tags`, `git log -1 --format=%cs <tag>`,
`gh release list`, and <https://github.com/TrustTunnel/TrustTunnelClient/packages/2733074/versions>
(the `gh api .../packages` endpoints return 403 without `read:packages`; the HTML page was used).

| Version              | Git tag?      | GitHub Release?        | Maven pkg?              | Date                     | Notes                                                                                    |
| -------------------- | ------------- | ---------------------- | ----------------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| 0.99.64              | **no tag**    | no                     | yes (2025-12-17T13:54Z) | 2025-12-17               | TwoHops' current pin. Not tagged; CHANGELOG has `0.99.63` (2025-12-16).                  |
| 0.99.66              | yes `b47e5f4` | yes                    | no                      | 2025-12-17               | First tag after 0.99.64 (same day). Used as the diff baseline.                           |
| 0.99.69 .. 0.99.105  | yes           | yes                    | no                      | 2025-12-22 .. 2026-02-03 | Core fixes; post-quantum default on (0.99.102); new error code (0.99.118, untagged).     |
| 1.0.5 .. 1.0.49      | some          | yes (1.0.14 .. 1.0.49) | yes                     | 2026-02-18 .. 2026-04-09 | 1.0 line. `[endpoint].dns_upstreams` move lands in 1.0.45 / tag v1.0.49.                 |
| 1.0.65               | no            | no                     | yes                     | 2026-05-05               | package only                                                                             |
| 1.1.3                | **no tag**    | no                     | **yes**                 | 2026-05-12               | **Latest stable Maven artifact**                                                         |
| **1.1.4**            | yes `7da863b` | no                     | no                      | 2026-05-22               | **Latest stable tag** (Linux C API only vs 1.1.3)                                        |
| 1.1.5-beta.1 .. rc.6 | yes           | yes (prerelease)       | yes                     | 2026-06-04 .. 2026-08-21 | Pre-release. Logging rework, `VpnService.initialize`, recovery-attempts breaking change. |

Note: the last non-prerelease _GitHub Release_ object is `v1.0.49` (2026-04-09); 1.1.x stable
shipped as tags/packages without Release objects.

Android adapter build parameters are unchanged across the whole range: `compileSdk = 35`,
`minSdk = 26`, Kotlin `2.0.21` (AGP 8.9.1), `kotlin("plugin.serialization") 2.2.0`
(`platform/android/lib/build.gradle.kts`, `platform/android/gradle/libs.versions.toml` at
v0.99.66, v1.1.4, v1.1.5-rc.6). TwoHops' `minSdkVersion = 26` / `kotlinVersion = "2.1.20"`
(`android/build.gradle`) remain compatible.

## 3. Breaking changes (0.99.64 -> 1.1.3/1.1.4)

### 3.1 Android adapter reads `dns_upstreams` from `[endpoint]` only -- AFFECTS TwoHops: **YES**

- What: `VpnServiceConfig` (the Kotlin TOML model the adapter uses to build the TUN interface)
  changed from a root-level `dns_upstreams` field to `endpoint.dns_upstreams` (default `[]`).
  `VpnService.createTunInterface` now branches on `config.endpoint.dnsUpstreams.isEmpty()`:
  empty -> the TUN gets AdGuard's real DNS server IPs (`ADGUARD_DNS_SERVERS`); non-empty -> the
  TUN gets the fake DNS server (`FAKE_DNS_SERVER`) that the core intercepts and forwards to your
  configured upstreams. The parser uses `ignoreUnknownNames = true`, so a root-level
  `dns_upstreams` is silently ignored, not rejected.
- Source: commit `6435b75e0aae4624c1e51b2e47fcf0a8c671b7cf` (2026-04-07, "Pull request 667:
  Support importing dns_servers and server_display_name from deeplink"), first stable tag
  `v1.0.49`. Files: `platform/android/lib/src/main/java/com/adguard/trusttunnel/VpnServiceConfig.kt`,
  `.../VpnService.kt`. CHANGELOG `[1.0.45] - 2026-04-07`: "The `dns_upstreams` field is moved to
  `[endpoint]` section. For backward compatibility, `dns_upstreams` in the root config section is
  still supported for old configs." -- that compatibility statement is true for the **core**
  (`trusttunnel/include/vpn/trusttunnel/config.h` has `legacy_dns_upstreams`; core README marks
  root `dns_upstreams` as **Legacy**), but **not** for the Android adapter's own TOML model.
- TwoHops impact: `src/services/configEncoder.ts:213` emits `dns_upstreams = ...` in the root
  section, before `[endpoint]` (line 216). The value comes from `server.dnsServers`
  (`configEncoder.ts:28`). After upgrading, the adapter would see an empty list and configure the
  TUN with AdGuard DNS IPs, while the core would still try to intercept using the legacy list --
  DNS behaviour changes silently. Fix: emit the key inside `[endpoint]` (keep the value the same).
  Core accepts it there since 1.0.45, so this change is safe to make before bumping the library.

### 3.2 Query-log ring buffer reimplemented (`PrefixedLenRingProto` -> `PersistentRingBuffer`) -- AFFECTS TwoHops: no (API), maybe (data)

- What: The Kotlin class `PrefixedLenRingProto` was deleted and replaced by `PersistentRingBuffer`
  backed by native code (`platform/android/lib/src/main/cpp/persistent_ring_buffer.cpp`);
  `read_all()` became `readAll()`. `VpnService.setAppNotifier(file, notifier)` signature is
  unchanged. Source: `git diff v0.99.66 v1.1.4 -- platform/android/lib/src/main/java`
  (files `PrefixedLenRingProto.kt` -103 lines, `PersistentRingBuffer.kt` +37 lines);
  CHANGELOG `[1.1.3]`: "Added C++ ring buffer implementation for use in Flutter Client".
- TwoHops impact: TwoHops never touches the class directly; it passes
  `File(filesDir, "query_log.dat")` to `setAppNotifier` (`NativeTrustTunnelModule.kt:97-98`). If
  the on-disk format differs, `readAll()` returns null and the adapter calls `clear()` on the
  first run after upgrade -- worst case the existing query-log history is dropped once.

### 3.3 `VpnClient.setSystemDnsServers` moved from instance to companion (static) -- AFFECTS TwoHops: no

- What: instance method `VpnClient.setSystemDnsServers(Array<String>, Array<String>?)` removed;
  companion `VpnClient.setSystemDnsServers(List<String>, List<String>?)` added. Source: same diff,
  `VpnClient.kt`.
- TwoHops does not use `VpnClient` (only `VpnService` / `AppNotifier`).

### 3.4 Pre-release only (1.1.5-\*), not in the recommended target -- listed for planning

- `[1.1.5-beta.10]` "**_Breaking change_**: New config parameter
  `ag::VpnUpstreamSessionRecoverySettings::attempts`... Now it will give up and raise
  `VPN_SS_DISCONNECTED` with `VPN_EC_LOCATION_UNAVAILABLE` after the specified number of
  unsuccessful attempts" (default ~1 minute total). This is a core/C-API change; for TwoHops it
  would surface as a state transition to `DISCONNECTED (0)` instead of indefinite `RECOVERING (4)`.
- `VpnService.initialize(context)` added (v1.1.5-rc.6 `VpnService.kt:147`); it installs the
  `FileLogger` and calls `startNetworkManager`. `exportLogs`/`clearLogs` return empty/no-op
  unless initialized. Existing `startNetworkManager` still exists, so current TwoHops code keeps
  working, but the intended entry point becomes `initialize`.
- Logging rework: `com.adguard.trusttunnel.log.LoggerManager` replaced by
  `com.adguard.trusttunnel.Logger` with a `Logger.setCallback` API; `FileLogger` added
  (CHANGELOG 1.1.5-beta.3/beta.6/beta.12). TwoHops uses `android.util.Log`, not the library logger.

## 4. Non-breaking notable changes (0.99.64 -> 1.1.4)

Android adapter (`git diff v0.99.66 v1.1.4 -- platform/android/lib/src/main/java`):

- **Config persistence for Always-On VPN**: `VpnService.start()` now saves the TOML config to
  `SharedPreferences("trusttunnel_vpn")` via new `VpnConfigStorage`; `VpnService.stop()` clears it;
  a system-triggered start (no action) loads the persisted config and connects. This means a
  config string containing credentials (`username`, `password`, `certificate`, per
  `configEncoder.ts:227-237`) is now stored unencrypted in app-private SharedPreferences.
- `startNetworkManager` is idempotent (`if (::networkCallback.isInitialized) return`) and
  synchronised; TwoHops' own `NetworkManagerState` guard (`NativeTrustTunnelModule.kt:139-149`)
  becomes redundant.
- `setAppNotifier` body now runs on the `eventsSync` executor (asynchronously) instead of
  synchronously assigning then posting; the replayed `onStateChanged(lastState)` and
  `onConnectionInfo` callbacks still arrive on that executor as before.
- `onStartCommand` / `processStarting` / `close` dropped the coarse `synchronized(SYNC)` lock.
- New `DeepLink.decode(uri)` object (JNI) for `tt://` deep-link import.
- `AppNotifier` (`onStateChanged(Int)`, `onConnectionInfo(String)`), `VpnState` codes
  (0..5: DISCONNECTED, CONNECTING, CONNECTED, WAITING_RECOVERY, RECOVERING, WAITING_FOR_NETWORK),
  `VpnPrepareActivity`, `VpnService.isPrepared` are unchanged.

Core / config format (CHANGELOG.md, `trusttunnel/README.md` diff v0.99.66..v1.1.4):

- `[endpoint].hostname` may carry a hostname in `addresses` (resolved at connect, 1.0.6).
- `[endpoint].custom_sni` replaces the `host|sni` pipe syntax (old syntax still accepted, 1.0.3).
- Post-quantum key exchange enabled by default (0.99.102). TwoHops sets
  `post_quantum_group_enabled` explicitly (`configEncoder.ts:178`), so no change.
- New recoverable error code `VPN_EC_CERTIFICATE_VERIFICATION_FAILED` (0.99.118).
- Exclusions: wildcard port syntax `*:port` (1.0.56).
- `[listener.tun]`: `tcp_recv_buf_size` / `tcp_send_buf_size` (1.0.63); `device_name` /
  `use_existing` (1.0.62; Windows `adapter_name` removed -- desktop only).
- `[1.1.3]` improved Linux network change detection; macOS link-local IPv6 DNS fix.

## 5. APIs TwoHops uses

Native module: `android/app/src/main/java/com/nativetrusttunnel/NativeTrustTunnelModule.kt`;
manifest: `android/app/src/main/AndroidManifest.xml`; config: `src/services/configEncoder.ts`.

| API / contract                                                                                                                                                                      | TwoHops location                                          | Status in 1.1.3 / 1.1.4                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `import com.adguard.trusttunnel.AppNotifier` + impl `onStateChanged(Int)`, `onConnectionInfo(String)`                                                                               | `NativeTrustTunnelModule.kt:10, 91, 113-121`              | Unchanged                                                                                                            |
| `VpnService.setAppNotifier(File, AppNotifier)`                                                                                                                                      | `NativeTrustTunnelModule.kt:98`                           | Signature unchanged; now executes asynchronously on the events executor; backing file format reimplemented (3.2)     |
| `VpnService.start(Context, String)`                                                                                                                                                 | `NativeTrustTunnelModule.kt:103`                          | Signature unchanged; now persists config to SharedPreferences (4)                                                    |
| `VpnService.stop(Context)`                                                                                                                                                          | `NativeTrustTunnelModule.kt:108`                          | Signature unchanged; now clears persisted config                                                                     |
| `VpnService.startNetworkManager(Context)`                                                                                                                                           | `NativeTrustTunnelModule.kt:144`                          | Signature unchanged; now idempotent (guard at :139-149 redundant). In 1.1.5-\* superseded by `VpnService.initialize` |
| `android.net.VpnService.prepare()` + `startActivityForResult`                                                                                                                       | `NativeTrustTunnelModule.kt:26-36`                        | Android platform API, unaffected                                                                                     |
| `<activity com.adguard.trusttunnel.VpnPrepareActivity>`                                                                                                                             | `AndroidManifest.xml:34`                                  | Class still present                                                                                                  |
| `<service com.adguard.trusttunnel.VpnService foregroundServiceType="systemExempted">`                                                                                               | `AndroidManifest.xml:38-45`                               | Class still present; no manifest changes required                                                                    |
| State codes 0..5 surfaced via `getCurrentState()` / `vpn_state` event                                                                                                               | `specs/NativeTrustTunnel.ts:12`, `src/services/vpn.ts:26` | `VpnState` unchanged                                                                                                 |
| TOML root key `dns_upstreams`                                                                                                                                                       | `configEncoder.ts:213`                                    | **BROKEN for the adapter** -- must move under `[endpoint]` (3.1)                                                     |
| TOML `[endpoint]` keys: `hostname, addresses, has_ipv6, username, password, client_random, skip_verification, certificate, upstream_protocol, upstream_fallback_protocol, anti_dpi` | `configEncoder.ts:216-243`                                | Still documented in `trusttunnel/README.md` at v1.1.4                                                                |
| TOML root keys `loglevel, vpn_mode, killswitch_enabled, post_quantum_group_enabled, exclusions`                                                                                     | `configEncoder.ts:161-201`                                | Unchanged                                                                                                            |
| TOML `[listener.tun]` `included_routes, excluded_routes, mtu_size`                                                                                                                  | `configEncoder.ts:252-263`                                | Unchanged (these are the only keys the Kotlin `Tun` model reads; they are required, non-defaulted)                   |
| Maven repo `maven.pkg.github.com/TrustTunnel/TrustTunnelClient`                                                                                                                     | `android/build.gradle:26`                                 | Unchanged; still needs `GITHUB_ACTOR`/`GITHUB_TOKEN`                                                                 |

iOS: TwoHops does **not** consume the iOS library. `ios/TrustTunnelModule.mm` is a stub
`RCTEventEmitter` with no TrustTunnel import; `ios/Podfile` has no TrustTunnel pod and there is no
`ios/Podfile.lock`; `project.pbxproj` has no `NetworkExtension` reference. Upstream ships the
Apple adapter as `platform/apple/TrustTunnelClient.podspec` (+ `build_framework.sh`) in the same
repo and same version stream, so an eventual iOS integration would pin the same `1.1.x` number.

## 6. Open questions / not verifiable from primary sources

1. **Exact contents of 0.99.64.** No git tag exists for it; the nearest tag `v0.99.66` was cut the
   same day (2025-12-17). This document diffs from `v0.99.66`. If 0.99.64 differs from 0.99.66 in
   the Android adapter, it is by at most a few commits that day; the CHANGELOG has no 0.99.64-0.99.66
   entries.
2. **Whether Maven `1.1.3` == tag `v1.1.4` for the Android AAR.** No `v1.1.3` tag exists and no
   `1.1.4` package exists. The CHANGELOG diff between them is Linux C API only, and the
   `platform/android` tree at `v1.1.4` is the best available source for what `1.1.3` contains.
3. **Package version listing completeness.** Retrieved by scraping the GitHub Packages HTML page
   (API needs `read:packages`); pages 1-2 were read (down to 0.99.22). A release could be missing
   from the scrape if the page layout hides entries.
4. **On-disk compatibility of `query_log.dat`** between `PrefixedLenRingProto` and the native
   `PersistentRingBuffer` was not tested; only the fallback path (`readAll()==null -> clear()`) was
   read from source.
5. **Behaviour with root-level `dns_upstreams` only** (3.1) is inferred from `createTunInterface`
   source; it was not run on a device. The direction of the change (fake-DNS interception no longer
   configured on the TUN) is certain, the user-visible symptom is not.
6. Whether the 1.1.5 line will keep `startNetworkManager` public or fold it into `initialize`
   cannot be known until it ships stable.
