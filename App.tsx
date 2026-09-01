/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import * as React from 'react';
import { Linking, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  createStaticNavigation,
  DarkTheme,
  DefaultTheme,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import {
  Ionicons,
  type IoniconsIconName,
} from '@react-native-vector-icons/ionicons/static';

import {
  SetupProfileProvider,
  useSetupProfile,
} from './src/context/SetupProfileContext';
import {
  TunnelSessionProvider,
  useTunnelSession,
} from './src/context/TunnelSessionContext';
import { LogsProvider } from './src/context/LogsContext';
import { displayState } from './src/services/tunnelSession';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { AlertProvider } from './src/components/AppAlert';
import { ToastProvider, useAppToast } from './src/components/AppToast';
import { getAppTheme, type AppTheme } from './src/theme/colors';
import DashboardScreen from './src/screens/DashboardScreen';
import LogsScreen from './src/screens/LogsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';

function tabIcon(
  focusedName: IoniconsIconName,
  unfocusedName: IoniconsIconName,
): NonNullable<BottomTabNavigationOptions['tabBarIcon']> {
  return ({ focused, color, size }) => (
    <Ionicons
      name={focused ? focusedName : unfocusedName}
      color={color}
      size={size}
    />
  );
}

// A twohops: deep link is a Profile Link: it creates a new profile and
// selects it while the Display State is Stopped (ADR 0003). Waits for
// hydration so the loaded list is not overwritten. Bad links are ignored —
// there is no screen context to complain in.
function ProfileLinkListener() {
  const { addFromProfileLink, isHydrated } = useSetupProfile();
  const {
    snapshot: { state },
  } = useTunnelSession();
  const stoppedRef = React.useRef(true);
  stoppedRef.current = displayState(state) === 'stopped';

  React.useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const apply = (url: string | null) => {
      if (url) {
        addFromProfileLink(url, stoppedRef.current);
      }
    };
    Linking.getInitialURL()
      .then(apply)
      .catch(() => {});
    const subscription = Linking.addEventListener('url', event =>
      apply(event.url),
    );
    return () => subscription.remove();
  }, [isHydrated, addFromProfileLink]);
  return null;
}

// Announces Session State transitions globally (issue #61): Connected and
// Disconnected get a Toast. Busy is carried by the connect control's spinner
// and the recovery states by the Dashboard's persistent detail label, so
// neither toasts. Mounted app-wide so a transition lands on any screen.
function SessionToastListener() {
  const {
    snapshot: { state },
  } = useTunnelSession();
  const toast = useAppToast();
  // Seeded with the initial state so mounting never announces anything.
  const previousRef = React.useRef(state);

  React.useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = state;
    if (state === previous) {
      return;
    }
    if (state === 'connected') {
      toast('Connected');
    } else if (state === 'disconnected') {
      // Also fires when a connect fails (connecting → disconnected): the
      // toast announces where the tunnel landed, not how it got there; the
      // Dashboard's error hint carries the Session Error.
      toast('Disconnected');
    }
  }, [state, toast]);
  return null;
}

// Navigators are created ONCE at module scope (issue #49): rebuilding them in
// render produces new component types, which unmounts the whole navigation
// tree on every theme change — resetting to Dashboard and wiping provider
// state. Theme reaches screenOptions through the navigation `theme` prop; the
// full AppTheme rides along on the `app` key.
type NavigationAppTheme = Theme & { app: AppTheme };

function toNavigationTheme(theme: AppTheme): NavigationAppTheme {
  const base = theme.isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: theme.isDark,
    colors: {
      ...base.colors,
      primary: theme.colors.buttonPrimary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
    },
    app: theme,
  };
}

// Falls back to the stock palette if <Navigation> ever renders without
// toNavigationTheme's output (e.g. a bare render in a test).
function appThemeOf(navigationTheme: Theme): AppTheme {
  const { app } = navigationTheme as NavigationAppTheme;
  return app ?? getAppTheme(navigationTheme.dark ? 'dark' : 'light');
}

function headerOptions(theme: AppTheme) {
  return {
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTitleStyle: { color: theme.colors.textPrimary },
    headerTintColor: theme.colors.textPrimary,
    headerShadowVisible: !theme.isDark,
  };
}

const MainTabs = createBottomTabNavigator({
  screenOptions: ({ theme: navigationTheme }) => {
    const theme = appThemeOf(navigationTheme);
    return {
      ...headerOptions(theme),
      tabBarStyle: { backgroundColor: theme.colors.surface },
      tabBarActiveTintColor: theme.colors.buttonPrimary,
      tabBarInactiveTintColor: theme.colors.textSecondary,
      sceneStyle: { backgroundColor: theme.colors.background },
    };
  },
  screens: {
    Dashboard: {
      screen: DashboardScreen,
      options: {
        title: 'Dashboard',
        tabBarIcon: tabIcon('speedometer', 'speedometer-outline'),
      },
    },
    Logs: {
      screen: LogsScreen,
      options: {
        title: 'Logs',
        tabBarIcon: tabIcon('reader', 'reader-outline'),
      },
    },
    Settings: {
      screen: SettingsScreen,
      options: {
        title: 'Settings',
        tabBarIcon: tabIcon('settings', 'settings-outline'),
      },
    },
  },
});

const RootStack = createNativeStackNavigator({
  screenOptions: ({ theme: navigationTheme }) => {
    const theme = appThemeOf(navigationTheme);
    return {
      ...headerOptions(theme),
      contentStyle: { backgroundColor: theme.colors.background },
    };
  },
  screens: {
    Main: {
      screen: MainTabs,
      options: { headerShown: false },
    },
    Profile: {
      screen: ProfileScreen,
      options: { title: 'Profile' },
    },
  },
});

const Navigation = createStaticNavigation(RootStack);

function AppNavigator() {
  const { theme } = useAppTheme();
  const navigationTheme = React.useMemo(
    () => toNavigationTheme(theme),
    [theme],
  );

  return (
    <>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.surface}
      />
      <AlertProvider>
        <ToastProvider>
          <SetupProfileProvider>
            <TunnelSessionProvider>
              <ProfileLinkListener />
              <SessionToastListener />
              <LogsProvider>
                <Navigation theme={navigationTheme} />
              </LogsProvider>
            </TunnelSessionProvider>
          </SetupProfileProvider>
        </ToastProvider>
      </AlertProvider>
    </>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
