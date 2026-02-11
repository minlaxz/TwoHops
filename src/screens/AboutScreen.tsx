import React from 'react';
import { Text } from 'react-native';
import MainScreen from '../components/views';

type AboutScreenRoute = {
    params: {
        name: string;
    };
};

export default function AboutScreen({ route }: { route: AboutScreenRoute }) {
    return (
        <MainScreen>
            <Text>About screen and params.param is {route.params.name}</Text>
        </MainScreen>
    );
}
