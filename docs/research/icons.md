# Tab bar icons for Dashboard / Logs / Settings (research, 2026-08-31)

Scope: the bottom tab bar (`App.tsx`) renders no icons because no `tabBarIcon` is set and no
icon package is installed. This doc picks an icon solution for TwoHops' stack (bare React
Native CLI, no Expo), verified against primary sources only (package READMEs/source on
GitHub, the npm registry, React Navigation docs). Placed in `docs/research/` following the
convention set by `trusttunnel-client-0.99.64-to-latest.md`.

## 1. TL;DR

- **Recommendation: `@react-native-vector-icons/ionicons` (v13.1.3), imported from the
  `/static` entry point.** It is the official successor to `react-native-vector-icons`
  (the old monolithic package is deprecated on npm with a pointer to the scoped packages),
  ships the Ionicons font + autolinking native config in one package, and needs no new
  transitive native dependencies.
- Icons to use (Ionicons has filled/outline pairs, which maps directly onto React
  Navigation's `focused` flag):

  | Tab       | focused       | unfocused             |
  | --------- | ------------- | --------------------- |
  | Dashboard | `speedometer` | `speedometer-outline` |
  | Logs      | `reader`      | `reader-outline`      |
  | Settings  | `settings`    | `settings-outline`    |

  All six names verified against the glyphmap shipped inside the package
  (`glyphmaps/Ionicons.json` in `@react-native-vector-icons/ionicons@13.1.3`, 1357 glyphs,
  Ionicons upstream v8.0.9).

- Install: `yarn add @react-native-vector-icons/ionicons`; Android needs a rebuild only;
  iOS needs `npx rnvi-update-plist package.json ios/TwoHops/Info.plist` + `pod install`.
- Runner-up (not chosen): `lucide-react-native`, which would require adding
  `react-native-svg` — a second native dependency the app does not otherwise need.

## 2. Current state of the repo

- `App.tsx:71-93` — `createBottomTabNavigator` (React Navigation v7 **static** API) defines
  the three tabs. Each screen's `options` sets only `title`; **no `tabBarIcon` anywhere in
  the repo**, so the tab bar renders labels without icons. Per the React Navigation v7
  bottom-tabs docs, `tabBarIcon` is "Function that given `{ focused: boolean, color: string,
size: number }` returns a React.Node, to display in the tab bar" — unset means no icon.
  ([bottom-tab-navigator docs][rn-nav-tabs])
- `package.json` — no icon package of any kind. Relevant stack: `react-native` 0.83.1,
  `react` 19.2.0, `@react-navigation/bottom-tabs` ^7.18.18.
- Pre-existing footgun: `react-native-svg-transformer` ^1.5.3 is in devDependencies and
  wired into `metro.config.js` (svg moved from `assetExts` to `sourceExts`), **but
  `react-native-svg` itself is not installed** (absent from `package.json` and
  `yarn.lock`). Importing any local `.svg` today would compile via the transformer and then
  fail at runtime on the missing `react-native-svg` module. The recommendation below does
  not depend on this machinery; if the transformer stays unused it could be removed, or
  `react-native-svg` added when local SVGs are actually wanted.
- `jest.config.js` — `transformIgnorePatterns` allows `react-native`, `@react-native`,
  `@react-navigation`, `react-native-.*`. The scoped `@react-native-vector-icons/*`
  packages do **not** match any of these alternatives (each must be followed by `/`).
  They publish precompiled CommonJS (`lib/commonjs/`), so Jest likely works untouched; if
  Jest ever chokes on them, add `@react-native-vector-icons` to the allowlist.

## 3. Options considered

### 3a. `@react-native-vector-icons/ionicons` (chosen)

- The legacy `react-native-vector-icons` package (latest 10.3.0) is **deprecated on npm**:
  "react-native-vector-icons package has moved to a new model of per-icon-family packages.
  See the MIGRATION.md on how to migrate" ([npm registry metadata][npm-rnvi];
  [MIGRATION.md][rnvi-migration]). The per-family packages live in the same repo
  ([oblador/react-native-vector-icons][rnvi-repo]).
- `@react-native-vector-icons/ionicons` latest is **13.1.3** (published 2026-08-20), sole
  dependency `@react-native-vector-icons/common` ^13.0.2. The Expo-related peers
  (`@expo/config-plugins` on ionicons; `expo-font`, `@react-native/assets-registry`,
  `get-image` on common) are all marked **optional** in `peerDependenciesMeta`, so a bare
  RN app installs nothing Expo. ([npm registry metadata][npm-ionicons])
- The package tarball contains the font (`fonts/Ionicons.ttf`), an Android library module
  (`android/build.gradle` + `VectorIconsIoniconsPackage.kt`) and a podspec
  (`react-native-vector-icons-ionicons.podspec`), so RN CLI autolinking picks it up — no
  `fonts.gradle` edits, unlike the legacy v10 setup. Verified by listing the published
  package contents on unpkg. ([package contents][unpkg-meta])
- Two entry points, verified in the published `src/index.ts` / `src/static.ts`:
  - `@react-native-vector-icons/ionicons/static` — font shipped in the native build
    (`createIconSet` without `fontSource`). **This is the right import for TwoHops.**
  - `@react-native-vector-icons/ionicons` (default) — dynamic font loading via
    `fontSource: require('../fonts/Ionicons.ttf')`, aimed at Expo Go.
    Both entries export `Ionicons` as a named and default export, plus a
    `IoniconsIconName` union type, so TypeScript rejects invalid icon names at compile time
    (the migration guide leans on exactly this: "The codemod will not catch this — but
    TypeScript will"). ([static.ts source][unpkg-static]; [MIGRATION.md][rnvi-migration])
- Ionicons set: v8.0.9, 1357 icons, listed under "Actively maintained" in the monorepo
  README. ([README][rnvi-repo])

### 3b. `lucide-react-native` (runner-up)

- Latest 1.38.0; peer-depends on `react-native-svg` ^12–^15. ([npm registry
  metadata][npm-lucide]; [lucide-react-native docs][lucide-docs])
- `react-native-svg` latest 15.15.5; its README compatibility table says >=15.13.0 requires
  RN >=0.78.0, and Fabric (New Architecture) is supported since 13.0.0 — so it does work on
  RN 0.83. ([react-native-svg README][svg-readme])
- Candidate glyphs all exist upstream (`layout-dashboard`, `gauge`, `logs`, `scroll-text`,
  `settings` — verified against `icons/*.json` in [lucide-icons/lucide][lucide-repo]).
- Not chosen because: (1) it adds `react-native-svg` as a new native dependency solely for
  three tab icons, while the rnvi route adds none; (2) Lucide is a stroke-only set — no
  filled/outline pairs, so the conventional focused/unfocused tab treatment needs stroke
  or fill tricks instead of a name swap.

### 3c. `@expo/vector-icons` — not applicable; it is the Expo wrapper around the same icon

sets and this is a bare RN CLI app (no `expo` package installed; the `eas.json`/EAS project
id in `app.json` doesn't change the runtime stack).

## 4. Install steps for this repo

From the official bare-RN setup guide ([SETUP-REACT-NATIVE.md][rnvi-setup-rn]):

```sh
yarn add @react-native-vector-icons/ionicons

# Android: nothing else — rebuild the app ("No extra steps needed for Android")

# iOS: register the font in Info.plist, then install pods
npx rnvi-update-plist package.json ios/TwoHops/Info.plist
cd ios && pod install
```

Then verify `ios/TwoHops/Info.plist` gained a `UIAppFonts` array containing
`Ionicons.ttf`, and rebuild both apps. The plist step must be re-run any time another
icon-family package is added.

## 5. Wiring it into the tab bar

`tabBarIcon` receives `{ focused, color, size }` ([bottom-tab-navigator
docs][rn-nav-tabs]); the theme's tint colors already set at `App.tsx:75-76`
(`tabBarActiveTintColor` / `tabBarInactiveTintColor`) flow in as `color`. Sketch against
the existing static config at `App.tsx:79-92`:

```tsx
import { Ionicons } from '@react-native-vector-icons/ionicons/static';

// inside createBottomTabNavigator({ screens: { ... } })
Dashboard: {
  screen: DashboardScreen,
  options: {
    title: 'Dashboard',
    tabBarIcon: ({ focused, color, size }) => (
      <Ionicons name={focused ? 'speedometer' : 'speedometer-outline'} color={color} size={size} />
    ),
  },
},
// Logs:     focused ? 'reader'   : 'reader-outline'
// Settings: focused ? 'settings' : 'settings-outline'
```

Alternate glyphs (also verified in the v13.1.3 glyphmap) if the look doesn't fit:
Dashboard `grid`/`grid-outline` or `pulse`/`pulse-outline`; Logs
`document-text`/`document-text-outline`, `terminal`/`terminal-outline`, or
`list`/`list-outline`; Settings `cog`/`cog-outline`.

## 6. Sources

- [React Navigation v7 bottom-tab-navigator docs][rn-nav-tabs] — `tabBarIcon` contract.
- [oblador/react-native-vector-icons README][rnvi-repo] — icon sets, installation, setup pointers.
- [SETUP-REACT-NATIVE.md][rnvi-setup-rn] — bare RN Android/iOS steps quoted in §4.
- [MIGRATION.md][rnvi-migration] — deprecation of the monolithic package, `/static` import style, codemod.
- [npm registry: @react-native-vector-icons/ionicons][npm-ionicons] — version 13.1.3, deps, optional peers.
- [npm registry: react-native-vector-icons][npm-rnvi] — deprecation notice on 10.3.0.
- [Published package contents (unpkg)][unpkg-meta] and [src/static.ts][unpkg-static] — native modules, font file, exports.
- Glyphmap: <https://unpkg.com/@react-native-vector-icons/ionicons@13.1.3/glyphmaps/Ionicons.json> — all recommended names checked present.
- [lucide-react-native docs][lucide-docs], [npm registry: lucide-react-native][npm-lucide], [lucide-icons/lucide][lucide-repo] — runner-up details.
- [software-mansion/react-native-svg README][svg-readme] — RN version + Fabric compatibility tables.

[rn-nav-tabs]: https://reactnavigation.org/docs/bottom-tab-navigator/
[rnvi-repo]: https://github.com/oblador/react-native-vector-icons
[rnvi-setup-rn]: https://github.com/oblador/react-native-vector-icons/blob/master/docs/SETUP-REACT-NATIVE.md
[rnvi-migration]: https://github.com/oblador/react-native-vector-icons/blob/master/MIGRATION.md
[npm-ionicons]: https://www.npmjs.com/package/@react-native-vector-icons/ionicons
[npm-rnvi]: https://www.npmjs.com/package/react-native-vector-icons
[unpkg-meta]: https://unpkg.com/browse/@react-native-vector-icons/ionicons@13.1.3/
[unpkg-static]: https://unpkg.com/@react-native-vector-icons/ionicons@13.1.3/src/static.ts
[lucide-docs]: https://lucide.dev/guide/packages/lucide-react-native
[npm-lucide]: https://www.npmjs.com/package/lucide-react-native
[lucide-repo]: https://github.com/lucide-icons/lucide
[svg-readme]: https://github.com/software-mansion/react-native-svg/blob/main/README.md
