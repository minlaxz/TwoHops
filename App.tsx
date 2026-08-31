/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import * as React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { SetupProfileProvider } from './src/context/SetupProfileContext';
import { TunnelSessionProvider } from './src/context/TunnelSessionContext';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import DashboardScreen from './src/screens/DashboardScreen';
import LogsScreen from './src/screens/LogsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';

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
          <Navigation />
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
