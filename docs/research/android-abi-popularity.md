# Which Android ABI do real devices need? (research, 2026-09-01)

Scope: TwoHops publishes four APKs per release (`app-universal.apk` plus per-ABI splits for
`arm64-v8a`, `armeabi-v7a`, `x86_64`). This doc answers which ABI real devices actually
need — i.e., which split APK a user should grab instead of `universal` — verified against
primary sources only (developer.android.com, Android Developers Blog, this repo's build
config, and the GitHub Releases API for `minlaxz/TwoHops`). Placed in `docs/research/`
following the convention set by `trusttunnel-client-0.99.64-to-latest.md`.

## 1. TL;DR

- **`arm64-v8a` is the practical default for any physical Android phone or tablet made in
  roughly the last decade.** Google Play has required 64-bit support since 2019, stopped
  serving 32-bit-only apps to 64-bit devices in 2021, and hardware is now shipping
  64-bit-only (Pixel 7 onward). No first-party market-share percentage exists (see §4),
  but every primary-source signal points the same way.
- **The universal APK costs ~3x the download for zero benefit on a known device:** in
  v0.0.11, `app-universal.apk` is **94.8 MB** vs **32.4 MB** for `app-arm64-v8a.apk`.
  Once installed, behavior is identical — the installer picks the matching native libs.
- **TwoHops' own numbers confirm the convenience pull of universal:** across all releases,
  `app-universal.apk` has 26 downloads vs 2 each for the three split APKs (§6). Users
  pick universal because it always works, not because they need the other ABIs.
- `armeabi-v7a` is only needed for old or low-end 32-bit hardware (Google still calls
  32-bit "important for Android Go, Android TV, and Android Wear"). `x86_64` is
  effectively emulator-only for this app's audience.

## 2. What this repo builds

- `android/app/build.gradle:129-135` — ABI splits `include "arm64-v8a", "armeabi-v7a",
"x86_64"` with `universalApk true` (no `x86` split, even though
  `android/gradle.properties:29` lists `x86` in `reactNativeArchitectures`).
- `.github/workflows/android.yaml:119-157` — `./gradlew assembleRelease` on a `[release]`
  commit, renames the four outputs to `app-universal.apk` / `app-arm64-v8a.apk` /
  `app-armeabi-v7a.apk` / `app-x86_64.apk`, and attaches all four to the GitHub release.

## 3. The primary-source picture

- **ABI definitions** — the Android NDK docs list exactly four supported ABIs:
  `armeabi-v7a` (32-bit Arm), `arm64-v8a` (AArch64), `x86`, `x86_64`; Gradle "builds for
  all non-deprecated ABIs by default".
  Source: <https://developer.android.com/ndk/guides/abis>
- **64-bit required since Aug 1, 2019** — "All new apps and app updates that include
  native code are required to provide 64-bit versions in addition to 32-bit versions when
  publishing to Google Play."
  Source: <https://android-developers.googleblog.com/2019/01/get-your-apps-ready-for-64-bit.html>
- **32-bit-only apps stopped being served to 64-bit devices on Aug 1, 2021** — "Google
  Play will stop serving apps without 64-bit versions on 64-bit capable devices, meaning
  they will no longer be available in the Play Store on those devices." (same source)
- **Hardware is going 64-bit-only** — "Pixel 7 and Pixel 7 Pro were the first Android
  phones to launch with support for only 64-bit apps" (Oct 2022). Google cites up to 25%
  better performance on 64-bit code and up to 150 MB RAM saved by dropping 32-bit. The
  same post says 32-bit "will continue to be important for Android Go, Android TV, and
  Android Wear" — that is where `armeabi-v7a` still matters.
  Sources: <https://android-developers.googleblog.com/2022/10/64-bit-only-devices.html>,
  <https://developer.android.com/games/optimize/64-bit>
- **Per-device delivery is Google's own recommendation** — App Bundles exist so "only the
  code and resources that are needed for a specific device are downloaded", giving "users
  smaller, more-optimized downloads". A universal APK is the opposite of this.
  Source: <https://developer.android.com/guide/app-bundle>

## 4. No first-party market-share number exists

Google publishes distribution dashboards for API levels and screen sizes, but **no
official Google/Arm figure for ABI market share among active devices**. Third-party
trackers (e.g., AppBrain device stats, Unity hardware reports) have long shown arm64 as
the overwhelming majority, but those are third-party estimates and were not verified
against a primary source for this doc — treat them as directional only. The primary-source
argument in §3 (Play policy since 2019/2021 plus 64-bit-only flagships since 2022) is what
this doc's conclusion rests on.

## 5. Universal APK tradeoff (v0.0.11 actual sizes)

| Asset                 | Size (MB) |
| --------------------- | --------- |
| `app-universal.apk`   | 94.8      |
| `app-arm64-v8a.apk`   | 32.4      |
| `app-x86_64.apk`      | 33.5      |
| `app-armeabi-v7a.apk` | 25.5      |

Sizes from the GitHub Releases API (`gh api repos/minlaxz/TwoHops/releases`), tag
`v0.0.11+2026090107`. The universal APK bundles all three ABIs' native libs; the device
only ever loads one set. The only thing universal buys is not having to know your ABI.
(To check a device: `adb shell getprop ro.product.cpu.abi`.)

## 6. What TwoHops users actually download

Cumulative per-asset download counts across all releases (GitHub Releases API,
2026-09-01):

| Asset                 | Total downloads |
| --------------------- | --------------- |
| `app-universal.apk`   | 26              |
| `app-arm64-v8a.apk`   | 2               |
| `app-armeabi-v7a.apk` | 2               |
| `app-x86_64.apk`      | 2               |

The sample is tiny and mostly the maintainer's own installs, so it measures convenience,
not device demographics: people take the APK guaranteed to install. Given §3, essentially
all of those universal installs would have been served equally well by `app-arm64-v8a.apk`
at about a third of the download size.

## 7. Practical takeaways

- Installing on a physical phone: take `app-arm64-v8a.apk`. Fall back to universal only if
  the install fails (which would indicate a 32-bit-only device — then `armeabi-v7a`).
- `app-x86_64.apk` is for the Android Emulator (and rare x86 hardware such as some
  ChromeOS devices).
- If download friction ever matters (public users, release notes), the release could
  order/label assets to steer people to `arm64-v8a` first — or note in the README that
  universal is the "don't know your ABI" fallback.
