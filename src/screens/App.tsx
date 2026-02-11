import * as React from 'react';
import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainScreen from './MainScreen';
// import DebugScreen from './DebugScreen';
import AboutScreen from './AboutScreen';
import ServerScreen from './ServerScreen';
import { SetupConfigProvider } from '../context/SetupConfigContext';

const RootStack = createNativeStackNavigator({
    screens: {
        Main: {
            screen: MainScreen,
            options: { title: 'Just in Two Hops' },
        },
        Server: {
            screen: ServerScreen,
            options: { title: 'Server Settings' },
        },
        About: {
            screen: AboutScreen,
            options: { title: 'About' }
        },
        // Debug: {
        //     screen: DebugScreen,
        //     options: { title: 'Debug Log' }
        // },
    },
});

const Navigation = createStaticNavigation(RootStack);

export default function InternalApp() {
    return (
        <SetupConfigProvider>
            <Navigation />
        </SetupConfigProvider>
    );
}
