/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import * as React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SetupConfigProvider } from './src/context/SetupConfigContext';
import DashboardScreen from './src/screens/DashboardScreen';
import AboutScreen from './src/screens/AboutScreen';
import ProfileScreen from './src/screens/ProfileScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const RootStack = createNativeStackNavigator({
    screens: {
      Dashboard: {
        screen: DashboardScreen,
        options: { title: 'Dashboard' },
      },
      Profile: {
        screen: ProfileScreen,
        options: { title: 'Profile' },
      },
      About: {
        screen: AboutScreen,
        options: { title: 'About' },
      },
    },
  });
  const Navigation = createStaticNavigation(RootStack);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SetupConfigProvider>
        <Navigation />
      </SetupConfigProvider>
    </SafeAreaProvider>
  );
}

export default App;
