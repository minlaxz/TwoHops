import type { ColorSchemeName, TextStyle, ViewStyle } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

// Design tokens (issue #78). Screens consume these only — no raw hex or
// ad-hoc spacing in screen styles. Scales are shared; each palette still
// spells out every token so light/dark parity is a type check.
const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

// display 34 / title 20 / body 15 / caption 13; weights: display bold,
// title semibold, body and caption regular (callers bump to '600' for
// emphasis, e.g. selected rows and button labels).
const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const satisfies Record<string, TextStyle>;

// Motion scale (issue #80): fast for pressed feedback, collapse fades and
// log-row entry; base for the Running glow, layout transitions and the
// Selected Profile highlight; slow for one Busy pulse half-period. Scales:
// press shrink, Busy pulse grow; opacity: the pressed dip.
const motion = {
  duration: { fast: 200, base: 400, slow: 600 },
  scale: { press: 0.97, pulse: 1.08 },
  opacity: { press: 0.7 },
} as const;

export type AppTheme = {
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceElevated: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    divider: string;
    inputBackground: string;
    inputBackgroundStrong: string;
    placeholder: string;
    buttonPrimary: string;
    buttonPrimaryText: string;
    buttonInactive: string;
    buttonInactiveText: string;
    switchTrackFalse: string;
    switchTrackTrue: string;
    switchThumbOn: string;
    switchThumbOff: string;
    link: string;
    danger: string;
    logBorder: string;
    // The Running green doubles as the brand accent (one story, both themes).
    accent: string;
    // Text/icon color on top of accent and status fills.
    onAccent: string;
    // Display State colors: Stopped neutral, Busy amber, Running green.
    status: { stopped: string; busy: string; running: string };
    overlay: string;
    shadow: string;
  };
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  motion: typeof motion;
  // Elevation levels: 0 flat, 1 resting card, 2 floating (FAB, toast).
  elevation: { level0: ViewStyle; level1: ViewStyle; level2: ViewStyle };
};

const SHADOW = '#000000';

// Warm green-tinted neutrals; xanadu (#738678) only as the Stopped fill —
// it fails AA as text on white. Secondary text is #57655c (≥5.4:1). Every
// text/fill pair here was contrast-checked (≥4.5:1 text, ≥3:1 icons).
const lightTheme: AppTheme = {
  isDark: false,
  colors: {
    background: '#f4f7f5',
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    textPrimary: '#141c18',
    textSecondary: '#57655c',
    border: '#d5ddd8',
    divider: '#e3e9e5',
    inputBackground: '#eef2ef',
    inputBackgroundStrong: '#e6ece8',
    placeholder: '#617068',
    buttonPrimary: '#2a3c33',
    buttonPrimaryText: '#ffffff',
    buttonInactive: '#dfe6e2',
    buttonInactiveText: '#141c18',
    switchTrackFalse: '#c3ccc6',
    switchTrackTrue: '#1b7d45',
    switchThumbOn: '#ffffff',
    switchThumbOff: '#f4f7f5',
    link: '#1b7d45',
    danger: '#b3261e',
    logBorder: '#e3e9e5',
    accent: '#1b7d45',
    onAccent: '#ffffff',
    status: { stopped: '#738678', busy: '#b56f00', running: '#1b7d45' },
    overlay: 'rgba(20, 28, 24, 0.5)',
    shadow: SHADOW,
  },
  spacing,
  radius,
  typography,
  motion,
  elevation: {
    level0: {},
    level1: {
      shadowColor: SHADOW,
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    level2: {
      shadowColor: SHADOW,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
  },
};

// Derived from blackish green #1a2421: background one step darker, elevated
// surfaces one step lighter; green accent/status on top.
const darkTheme: AppTheme = {
  isDark: true,
  colors: {
    background: '#131a17',
    surface: '#1a2421',
    surfaceElevated: '#222c28',
    textPrimary: '#eef3ef',
    textSecondary: '#a3b3aa',
    border: '#2d3a34',
    divider: '#26312c',
    inputBackground: '#222c28',
    inputBackgroundStrong: '#2a3630',
    placeholder: '#7f8f86',
    buttonPrimary: '#4cd37a',
    buttonPrimaryText: '#131a17',
    buttonInactive: '#3a4a41',
    buttonInactiveText: '#eef3ef',
    switchTrackFalse: '#3a4a41',
    switchTrackTrue: '#4cd37a',
    switchThumbOn: '#eef3ef',
    switchThumbOff: '#a3b3aa',
    link: '#4cd37a',
    danger: '#e5534b',
    logBorder: '#26312c',
    accent: '#4cd37a',
    onAccent: '#131a17',
    status: { stopped: '#738678', busy: '#f2b544', running: '#4cd37a' },
    overlay: 'rgba(0, 0, 0, 0.6)',
    shadow: SHADOW,
  },
  spacing,
  radius,
  typography,
  motion,
  elevation: {
    level0: {},
    level1: {
      shadowColor: SHADOW,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    level2: {
      shadowColor: SHADOW,
      shadowOpacity: 0.4,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
  },
};

export function getAppTheme(colorScheme: ColorSchemeName): AppTheme {
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}

export function resolveColorScheme(
  themePreference: ThemePreference,
  systemColorScheme: ColorSchemeName,
): 'light' | 'dark' {
  if (themePreference === 'light' || themePreference === 'dark') {
    return themePreference;
  }

  return systemColorScheme === 'dark' ? 'dark' : 'light';
}
