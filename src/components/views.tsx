import { ScrollView, StyleSheet } from 'react-native';

type MainScreenProps = {
    children?: React.ReactNode;
};

export default function MainScrollView({ children }: MainScreenProps) {

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {children}
        </ScrollView>
    );
}


const styles = StyleSheet.create({
    container: {
        padding: 24,
        backgroundColor: '#f5f5f5',
        alignItems: 'stretch',
    }
});
