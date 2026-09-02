# Component library: current state vs React Native Reusables (research, 2026-09-02)

Scope: what UI/component library TwoHops uses today, what React Native Reusables
(https://reactnativereusables.com/) is, and how the two relate. Verified against primary
sources only: this repo's own files, and the `founded-labs/react-native-reusables` GitHub
repo (its docs site content lives in that repo under `apps/docs/content/docs/`), plus the
NativeWind installation docs. Placed in `docs/research/` following the convention set by
`icons.md` and `trusttunnel-client-0.99.64-to-latest.md`.

## 1. TL;DR

- **TwoHops uses no component library at all.** Every component is hand-rolled with
  React Native core primitives and `StyleSheet.create`, themed through a custom
  `src/theme/colors.ts` + `src/context/ThemeContext` pair. There is no NativeWind, no
  Tailwind, no `@rn-primitives/*`, no gluestack/tamagui/paper — none of them appear in
  `package.json` or anywhere in the source.
- **React Native Reusables is not a dependency you install; it is shadcn/ui for React
  Native**: a CLI copies component source files into your repo, built on
  NativeWind (or Uniwind) for styling and `@rn-primitives/*` (a Radix UI port) for
  behavior.
- **Nothing in TwoHops overlaps with the RN Reusables stack today.** Adopting it would
  mean introducing its entire foundation first — NativeWind + Tailwind config, Babel/Metro
  changes, `class-variance-authority`/`clsx`/`tailwind-merge`, `@rn-primitives/portal`, a
  CSS-variable theme — and it would sit alongside (or replace) the existing
  `ThemeContext`/`StyleSheet` system. Its docs and `init` template are Expo-centric, but
  the underlying NativeWind explicitly supports framework-less (bare CLI) projects like
  this one; the manual-install path is the relevant one.

## 2. What TwoHops uses today (repo evidence)

### Dependencies

`package.json` (v0.0.13) has **no styling or component-library dependency**. The complete
runtime dependency list is:

- `@react-native-async-storage/async-storage` ^2.2.0
- `@react-native-vector-icons/ionicons` ^13.1.3
- `@react-navigation/bottom-tabs` ^7.18.18, `@react-navigation/native` ^7.3.18,
  `@react-navigation/native-stack` ^7.18.10
- `react` 19.2.0, `react-native` 0.83.1
- `react-native-config` ^1.6.1, `react-native-safe-area-context` ^5.5.2,
  `react-native-screens` ~4.16.0

Nothing named `nativewind`, `tailwindcss`, `@rn-primitives/*`, `gluestack`, `tamagui`,
`react-native-paper`, or `styled-components` exists in `package.json`, and a repo-wide
grep for those strings in `*.ts`/`*.tsx`/`*.json` (excluding `node_modules`) returns zero
matches.

### Build config

- `babel.config.js` is the stock `@react-native/babel-preset` only — no
  `nativewind/babel` preset.
- `metro.config.js` is the default RN metro config plus `react-native-svg-transformer` —
  no `withNativeWind` wrapper.
- There is no `tailwind.config.*`, no `global.css`, no `nativewind-env.d.ts` at the repo
  root.
- The project is **bare React Native CLI** (`@react-native-community/cli` 20.0.0 in
  devDependencies, native `android/`/`ios/` directories, TurboModule codegen for
  `NativeTrustTunnelSpec`), not Expo.

### Components and styling

`src/components/` holds five hand-rolled files — `AppAlert.tsx`, `AppToast.tsx`,
`CollapsibleSection.tsx`, `buttons.tsx`, `views.tsx` (30–163 lines each). Every one of
them, and all four screens in `src/screens/` (`DashboardScreen`, `LogsScreen`,
`ProfileScreen`, `SettingsScreen`), uses `StyleSheet.create`; none uses `className`.
Their only imports are `react`/`react-native` plus the in-repo theme:

- `src/theme/colors.ts` — defines `ThemePreference` (`system | light | dark`) and an
  `AppTheme` type with a named color palette (`background`, `surface`, `textPrimary`,
  `textSecondary`, `border`, `divider`, `inputBackground`, …).
- `src/context/ThemeContext` — distributes the theme to components.

So the answer to "what component library is used" is: **a small in-house one**, colocated
in `src/components/` and styled via `StyleSheet` + `ThemeContext`.

## 3. What React Native Reusables is (primary sources)

Source repo: `founded-labs/react-native-reusables` (MIT, ~8.6k stars, homepage
https://reactnativereusables.com; repo description: "Bringing shadcn/ui to React Native.
Beautifully crafted components with Nativewind/Uniwind"). The docs site content is
committed in that repo under `apps/docs/content/docs/`; claims below cite those files.

### Philosophy (`docs/index.mdx`)

Quoting shadcn/ui: _"This is not a component library. It is how you build your component
library."_ Components are **copied into your project as source** (under
`@/components/ui/…`) rather than installed as a package. Key differences from web
shadcn/ui, per the same page:

- **Styling**: NativeWind or Uniwind (Tailwind-like styling for React Native).
- **Primitives**: `@rn-primitives/*` (https://rnprimitives.com), a universal port of
  Radix UI primitives with an almost identical API.
- **Portals**: RN has no DOM portals; overlay components (dropdowns, popovers, tooltips)
  need a `PortalHost` from `@rn-primitives/portal` in the root layout.
- **No cascading styles**: child `Text` can't inherit from a parent class; they use a
  small inheritance workaround for `Text`.
- **No `data-*` attributes**: variants rely on props/state instead.
- **Animation**: uses `react-native-reanimated`.
- **Icons**: an `<Icon as={SomeLucideIcon} />` wrapper around `lucide-react-native`
  (note: TwoHops standardized on `@react-native-vector-icons/ionicons` — see
  `docs/research/icons.md`).
- Some components (e.g. `DropdownMenu`) are controlled via `ref`, not `open` props.

### Installation (`docs/installation/index.mdx`, `docs/installation/manual.mdx`, `docs/cli.mdx`)

Two paths:

1. **CLI `init`** — scaffolds a **new Expo project** from a template (`minimal`,
   `minimal-uniwind`, `clerk-auth`). Not applicable to an existing bare-CLI app.
2. **Manual setup for an existing project** — the path that would apply to TwoHops:

   1. Install NativeWind per its official guide.
   2. Set `inlineRem: 16` in `metro.config.js` (docs show the Expo variant of the
      config).
   3. Add `tailwindcss-animate`, `class-variance-authority`, `clsx`, `tailwind-merge`,
      `@rn-primitives/portal`.
   4. Render `PortalHost` as the last child of the root providers.
   5. Configure a `@/*` path alias in `tsconfig.json`.
   6. Add shadcn-style CSS-variable theme tokens (`--background`, `--foreground`,
      `--card`, …) to `global.css`.

   After setup, `npx react-native-reusables add button` (etc.) copies component source
   into the repo; the `add` command "uses the shadcn CLI under the hood" and detects
   NativeWind vs Uniwind (`--styling-library` to override).

### Bare React Native CLI compatibility

RN Reusables' own docs assume Expo throughout (`init` is Expo-only; manual steps show
`expo/metro-config` and `npx expo install`). The prerequisite that decides feasibility is
NativeWind, whose installation docs state: _"Nativewind works with both Expo and
framework-less React Native projects but Expo provides a more streamlined experience"_
(https://www.nativewind.dev/docs/getting-started/installation, page dated 2026-01-10). So
bare-CLI adoption is supported but is the less-trodden path, and every Expo-flavored doc
snippet has to be translated to the community-CLI equivalent by hand.

## 4. What adopting it would mean for TwoHops

- **New foundation, not an add-on.** None of the RN Reusables stack is present, so
  step one is the full NativeWind install: `tailwindcss` + `tailwind.config.js` +
  `global.css`, the `nativewind/babel` preset in `babel.config.js`, and wrapping
  `metro.config.js` with `withNativeWind` — the metro file already has a custom
  svg-transformer config that would need merging.
- **Two theme systems or a migration.** RN Reusables themes via Tailwind CSS variables
  (`--background`, `--card`, …); TwoHops themes via `AppTheme` in `src/theme/colors.ts`
  consumed through `ThemeContext`. Running both means every screen mixes `className` and
  `StyleSheet`; converging means porting the existing palette into Tailwind tokens and
  migrating the five components + four screens.
- **New transitive dependencies** for a deliberately small app: NativeWind/Tailwind,
  `class-variance-authority`, `clsx`, `tailwind-merge`, `@rn-primitives/*` per
  component, `react-native-reanimated` for animated components, and (if following their
  icon convention) `lucide-react-native` alongside the already-chosen Ionicons package.
- **What you'd gain**: owned, editable source for accessible, composable primitives
  (dialogs, dropdowns, popovers via the portal system) with consistent shadcn-style
  variants — components the in-house set doesn't have and would otherwise be hand-built
  on top of RN core.
- **Fit note**: the app currently ships five small components; the cost of the
  foundation swap is front-loaded, and pays off only if a meaningful amount of new UI
  (especially overlay/menu-type components) is planned.

## 5. Sources

Repo (state as of commit `9946629`, v0.0.13):

- `package.json` — dependency list, bare-CLI devDependencies, codegen config
- `babel.config.js`, `metro.config.js` — no NativeWind wiring
- `src/components/` (`AppAlert.tsx`, `AppToast.tsx`, `CollapsibleSection.tsx`,
  `buttons.tsx`, `views.tsx`) — all `StyleSheet.create`, no `className`
- `src/screens/` (4 screens) — same
- `src/theme/colors.ts`, `src/context/ThemeContext` — in-house theming
- `docs/research/icons.md` — prior icon decision (Ionicons)

Web (all fetched 2026-09-02):

- https://github.com/founded-labs/react-native-reusables — repo metadata, README
- `apps/docs/content/docs/index.mdx` in that repo — philosophy, key differences
  (rendered at https://reactnativereusables.com/docs)
- `apps/docs/content/docs/installation/index.mdx` and `installation/manual.mdx` — CLI
  and manual install steps (rendered at https://reactnativereusables.com/docs/installation)
- `apps/docs/content/docs/cli.mdx` — `init`/`add`/`doctor` commands, templates
- https://www.nativewind.dev/docs/getting-started/installation — Expo vs framework-less
  support statement
