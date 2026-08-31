/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import * as React from 'react';
import { Linking, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

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
import DashboardScreen from './src/screens/DashboardScreen';
import LogsScreen from './src/screens/LogsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';

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

function AppNavigator() {
  const { theme } = useAppTheme();
  const headerOptions = {
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTitleStyle: { color: theme.colors.textPrimary },
    headerTintColor: theme.colors.textPrimary,
    headerShadowVisible: !theme.isDark,
  };
  const MainTabs = createBottomTabNavigator({
    screenOptions: {
      ...headerOptions,
      tabBarStyle: { backgroundColor: theme.colors.surface },
      tabBarActiveTintColor: theme.colors.buttonPrimary,
      tabBarInactiveTintColor: theme.colors.textSecondary,
      sceneStyle: { backgroundColor: theme.colors.background },
    },
    screens: {
      Dashboard: {
        screen: DashboardScreen,
        options: { title: 'Dashboard' },
      },
      Logs: {
        screen: LogsScreen,
        options: { title: 'Logs' },
      },
      Settings: {
        screen: SettingsScreen,
        options: { title: 'Settings' },
      },
    },
  });
  const RootStack = createNativeStackNavigator({
    screenOptions: {
      ...headerOptions,
      contentStyle: { backgroundColor: theme.colors.background },
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

  return (
    <>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.surface}
      />
      <SetupProfileProvider>
        <TunnelSessionProvider>
          <ProfileLinkListener />
          <LogsProvider>
            <Navigation />
          </LogsProvider>
        </TunnelSessionProvider>
      </SetupProfileProvider>
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
