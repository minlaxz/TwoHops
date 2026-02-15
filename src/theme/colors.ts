import type { ColorSchemeName } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

export type AppTheme = {
  isDark: boolean;
  colors: {
    background: string;
    surface: string;
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
    switchTrackFalse: string;
    switchTrackTrue: string;
    switchThumbOn: string;
    switchThumbOff: string;
    link: string;
    danger: string;
    logBorder: string;
  };
};

const lightTheme: AppTheme = {
  isDark: false,
  colors: {
    background: '#f5f5f5',
    surface: '#ffffff',
    textPrimary: '#121212',
    textSecondary: '#666666',
    border: '#d9d9d9',
    divider: '#d9d9d9',
    inputBackground: '#ededed',
    inputBackgroundStrong: '#f5f5f5',
    placeholder: '#7a7a7a',
    buttonPrimary: '#121212',
    buttonPrimaryText: '#ededed',
    buttonInactive: '#4f4f4f',
    switchTrackFalse: '#7f8288',
    switchTrackTrue: '#31425e',
    switchThumbOn: '#000000',
    switchThumbOff: '#f4f3f4',
    link: '#5bb1cb',
    danger: '#8b1f1f',
    logBorder: '#ececec',
  },
};

const darkTheme: AppTheme = {
  isDark: true,
  colors: {
    background: '#0f1115',
    surface: '#171a21',
    textPrimary: '#f2f4f8',
    textSecondary: '#a3adbc',
    border: '#2f3542',
    divider: '#2a2f39',
    inputBackground: '#1f2530',
    inputBackgroundStrong: '#252c38',
    placeholder: '#8892a0',
    buttonPrimary: '#f2f4f8',
    buttonPrimaryText: '#0f1115',
    buttonInactive: '#2f3745',
    switchTrackFalse: '#3a4252',
    switchTrackTrue: '#5673b8',
    switchThumbOn: '#ffffff',
    switchThumbOff: '#c7cfda',
    link: '#7cd6f2',
    danger: '#b93a3a',
    logBorder: '#2a2f39',
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
