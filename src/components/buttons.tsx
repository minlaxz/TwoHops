import { StyleSheet, TouchableOpacity, Text, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

type CustomButtonProps = {
    title?: string;
    disabled?: boolean;
    onPress?: () => void;
    touchableOpacityStyles?: StyleProp<ViewStyle>;
    textStyles?: StyleProp<TextStyle>;
};

export const TouchableOpacityButton: React.FC<CustomButtonProps> = ({ title, onPress, disabled, touchableOpacityStyles, textStyles }) => {
    return (
        <TouchableOpacity style={[styles.button, touchableOpacityStyles]} onPress={onPress} disabled={disabled}>
            <Text style={[styles.buttonText, textStyles]}>{title}</Text>
        </TouchableOpacity>
    );
};

export const TouchableOpacityLink: React.FC<CustomButtonProps> = ({ title, onPress, disabled, textStyles }) => {
    return (
        <TouchableOpacity onPress={onPress} disabled={disabled}>
            <Text style={[styles.link, textStyles]}>{title}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        height: 50,
        width: "50%",
        backgroundColor: '#121212',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        padding: 10,
    },
    buttonText: {
        color: '#ededed',
        fontSize: 18,
        fontWeight: 'bold',
    },
    link: {
        color: '#5bb1cb',
        textDecorationLine: 'underline',
        textDecorationColor: '#5bb1cb',
    },
});
