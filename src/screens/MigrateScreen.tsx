import React from 'react';
import { Text } from 'react-native';
import MainScreen from '../components/views';

type MigrateScreenRoute = {
  params: {
    url: string;
  };
};

export default function MigrateScreen({ route }: { route: MigrateScreenRoute }) {
  return (
    <MainScreen>
      <Text>Migrate screen and params.param is {route.params.url}</Text>
    </MainScreen>
  );
}
