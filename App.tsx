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

import { SetupConfigProvider } from './src/context/SetupConfigContext';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import DashboardScreen from './src/screens/DashboardScreen';
import DebugScreen from './src/screens/DebugScreen';
import ProfileScreen from './src/screens/ProfileScreen';

function AppNavigator() {
  const { theme } = useAppTheme();
  const RootStack = createNativeStackNavigator({
    screenOptions: {
      headerStyle: { backgroundColor: theme.colors.surface },
      headerTitleStyle: { color: theme.colors.textPrimary },
      headerTintColor: theme.colors.textPrimary,
      headerShadowVisible: !theme.isDark,
      contentStyle: { backgroundColor: theme.colors.background },
    },
    screens: {
      Dashboard: {
        screen: DashboardScreen,
        options: { title: 'Dashboard' },
      },
      Profile: {
        screen: ProfileScreen,
        options: { title: 'Profile' },
      },
      Debug: {
        screen: DebugScreen,
        options: { title: 'Debug' },
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
      <SetupConfigProvider>
        <Navigation />
      </SetupConfigProvider>
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
