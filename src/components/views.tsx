import { ScrollView, StyleSheet } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

type MainScreenProps = {
  children?: React.ReactNode;
};

export default function MainScrollView({ children }: MainScreenProps) {
  const { theme } = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'stretch',
  },
});
