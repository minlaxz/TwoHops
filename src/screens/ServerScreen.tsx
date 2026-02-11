import React from 'react';
import { Text, StyleSheet, View, TextInput } from 'react-native';
import MainScreen from '../components/views';
import { TouchableOpacityButton } from '../components/buttons';
import { useSetupConfig } from '../context/SetupConfigContext';

export default function ServerScreen() {
    const {
        server,
        setServer,
        dnsServersText,
        setDnsServersText,
        routingMode,
        setRoutingMode,
        localRoutingRulesText,
        setLocalRoutingRulesText,
        remoteRoutingURL,
        setRemoteRoutingURL,
    } = useSetupConfig();

    return (
        <MainScreen>
            <Text style={styles.title}>Setup Configuration</Text>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Server</Text>
                {/* <TextInput
                    style={styles.input}
                    placeholder="Server Name (any)"
                    value={server.name}
                    onChangeText={(value) => setServer((prev) => ({ ...prev, name: value }))}
                  /> */}
                <TextInput
                    style={styles.input}
                    placeholder="Server IP Address"
                    value={server.ipAddress}
                    onChangeText={(value) => setServer((prev) => ({ ...prev, ipAddress: value }))}
                    autoCapitalize="none"
                />
                <TextInput
                    style={styles.input}
                    placeholder="TLS Domain Name"
                    value={server.domain}
                    onChangeText={(value) => setServer((prev) => ({ ...prev, domain: value }))}
                    autoCapitalize="none"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Username"
                    value={server.login}
                    onChangeText={(value) => setServer((prev) => ({ ...prev, login: value }))}
                    autoCapitalize="none"
                />
                <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="Password"
                    value={server.password}
                    onChangeText={(value) => setServer((prev) => ({ ...prev, password: value }))}
                    secureTextEntry
                />
                <Text style={styles.inputLabel}>DNS Servers:</Text>
                <TextInput
                    style={styles.input}
                    placeholder="DNS Servers (comma-separated)"
                    value={dnsServersText}
                    onChangeText={setDnsServersText}
                    autoCapitalize="none"
                />
                <Text style={styles.sectionTitle}>Routing</Text>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Mode: {routingMode}</Text>
                    <View style={styles.rowButtons}>
                        <TouchableOpacityButton
                            touchableOpacityStyles={[
                                styles.modeButton,
                                routingMode === 'general' ? styles.modeButtonActive : styles.modeButtonInactive,
                            ]}
                            textStyles={styles.modeButtonText}
                            title="General"
                            onPress={() => setRoutingMode('general')}
                        />
                        <View style={styles.rowSpacer} />
                        <TouchableOpacityButton
                            touchableOpacityStyles={[
                                styles.modeButton,
                                styles.modeButtonWide,
                                routingMode === 'selective' ? styles.modeButtonActive : styles.modeButtonInactive,
                            ]}
                            textStyles={styles.modeButtonText}
                            title="Selective"
                            onPress={() => setRoutingMode('selective')}
                        />
                    </View>
                </View>
                <Text style={styles.inputLabel}>Local Rules (comma/new line):</Text>
                <TextInput
                    style={styles.multilineInput}
                    placeholder="example.com, myip.wtf"
                    value={localRoutingRulesText}
                    onChangeText={setLocalRoutingRulesText}
                    autoCapitalize="none"
                    multiline
                    textAlignVertical="top"
                />
                <Text style={styles.inputLabel}>Remote Rules URL:</Text>
                <TextInput
                    style={styles.input}
                    placeholder="https://..."
                    value={remoteRoutingURL}
                    onChangeText={setRemoteRoutingURL}
                    autoCapitalize="none"
                />
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Protocol: {server.vpnProtocol}</Text>
                    <View style={styles.rowButtons}>
                        <TouchableOpacityButton
                            touchableOpacityStyles={[
                                styles.protocolButton,
                                server.vpnProtocol === 'Http/2' ? styles.modeButtonActive : styles.modeButtonInactive,
                            ]}
                            textStyles={styles.modeButtonText}
                            title="Http/2"
                            onPress={() => setServer((prev) => ({ ...prev, vpnProtocol: 'Http/2' }))}
                        />
                        <View style={styles.rowSpacer} />
                        <TouchableOpacityButton
                            touchableOpacityStyles={[
                                styles.protocolButton,
                                server.vpnProtocol === 'QUIC' ? styles.modeButtonActive : styles.modeButtonInactive,
                            ]}
                            textStyles={styles.modeButtonText}
                            title="QUIC"
                            onPress={() => setServer((prev) => ({ ...prev, vpnProtocol: 'QUIC' }))}
                        />
                    </View>
                </View>
            </View>
        </MainScreen>
    );
}


const styles = StyleSheet.create({
    section: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#fff',
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
    title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
    inputLabel: { fontSize: 12, marginBottom: 4 },
    input: {
        borderWidth: 1,
        borderColor: '#d9d9d9',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
        backgroundColor: '#ededed',
    },
    passwordInput: {
        backgroundColor: '#f5f5f5',
        color: '#333',
    },
    multilineInput: {
        borderWidth: 1,
        borderColor: '#d9d9d9',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
        backgroundColor: '#ededed',
        minHeight: 100,
    },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    rowLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
    rowButtons: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, overflow: 'hidden' },
    rowSpacer: { width: 8 },
    modeButton: {
        width: 70,
        height: 40,
        padding: 4,
    },
    modeButtonWide: {
        width: 80,
    },
    protocolButton: {
        width: 60,
        height: 40,
        padding: 4,
    },
    modeButtonActive: {
        backgroundColor: '#121212',
    },
    modeButtonInactive: {
        backgroundColor: '#dedede',
    },
    modeButtonText: {
        color: '#fff',
        fontSize: 12,
    },
})
