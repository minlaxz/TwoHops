import React, { useState } from 'react';
import { Text, StyleSheet, View, TextInput } from 'react-native';
import MainScreen from '../components/views';
import { TouchableOpacityButton } from '../components/buttons';
import { useSetupConfig } from '../context/SetupConfigContext';
import { splitList, fetchRemoteURL } from '../services/utils';

export default function ServerScreen() {
  const {
    server,
    setServer,
    routingMode,
    setRoutingMode,
    rulesText,
    setRulesText,
    dnsServersText,
    setDnsServersText,
  } = useSetupConfig();

  const [localRoutingRulesText, setLocalRoutingRulesText] = useState<string>('');
  const [remoteRoutingURL, setRemoteRoutingURL] = useState<string>('');
  const [url, setURL] = useState<string>('');

  return (
    <MainScreen>
      <Text style={styles.title}>Configurations</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Simple</Text>
        <TextInput
          style={styles.input}
          placeholder="Single URL"
          value={url}
          onChangeText={setURL}
          autoCapitalize="none"
        />
        <Text style={styles.inputDescription}>
          This section is for users who want a quick setup without filling in individual fields.
          You can paste a single URL containing all necessary information,
          and the app will attempt to parse it to fill in the details automatically.
        </Text>
        <TouchableOpacityButton
          touchableOpacityStyles={[styles.modeButton, styles.modeButtonWide]}
          textStyles={styles.modeButtonText}
          title="Auto Fill"
          onPress={() => {
            // Example URL format:
            // twohops://import-profile?login=user&password=password==&ip=1.2.3.4&domain=tls-domain.example.com&dns=https://dns.nextdns.io&remoteRules=https://example.comrules.txt
            try {
              const urlObj: globalThis.URL = new URL(url);

              if (urlObj.protocol !== 'twohops:') {
                throw new Error('Invalid URL scheme');
              }

              const login = urlObj.searchParams.get('login') ?? '';
              const parsedPassword = urlObj.searchParams.get('password') ?? '';
              const ipAddress = urlObj.searchParams.get('ip') ?? '';
              const domain = urlObj.searchParams.get('domain') ?? '';
              const protocolParam = urlObj.searchParams.get('protocol');
              const vpnProtocol = protocolParam === 'Http/2' ? 'Http/2' : 'QUIC';
              const dns = urlObj.searchParams.get('dns') ?? '';
              const remoteRulesURL = urlObj.searchParams.get('remoteRules') ?? '';

              setServer(prev => ({
                ...prev,
                ipAddress,
                domain,
                login,
                password: parsedPassword,
                vpnProtocol,
              }));

              setDnsServersText(dns);
              setRemoteRoutingURL(remoteRulesURL);
            } catch (error) {
              console.error('Failed to parse URL:', error);
            }

          }}
        />
        <View style={styles.line} />
        <Text style={styles.sectionTitle}>Advance</Text>
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={server.name}
          onChangeText={value => setServer(prev => ({ ...prev, name: value }))}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Server IP Address"
          value={server.ipAddress}
          onChangeText={value =>
            setServer(prev => ({ ...prev, ipAddress: value }))
          }
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="TLS Domain Name"
          value={server.domain}
          onChangeText={value =>
            setServer(prev => ({ ...prev, domain: value }))
          }
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={server.login}
          onChangeText={value => setServer(prev => ({ ...prev, login: value }))}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, styles.passwordInput]}
          placeholder="Password"
          value={server.password}
          onChangeText={value =>
            setServer(prev => ({ ...prev, password: value }))
          }
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
        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            Mode: {server.vpnProtocol.toLowerCase()}
          </Text>
          <View style={styles.rowButtons}>
            <TouchableOpacityButton
              touchableOpacityStyles={[
                styles.protocolButton,
                server.vpnProtocol === 'Http/2'
                  ? styles.modeButtonActive
                  : styles.modeButtonInactive,
              ]}
              textStyles={styles.modeButtonText}
              title="Http/2"
              onPress={() =>
                setServer(prev => ({ ...prev, vpnProtocol: 'Http/2' }))
              }
            />
            <View style={styles.rowSpacer} />
            <TouchableOpacityButton
              touchableOpacityStyles={[
                styles.protocolButton,
                server.vpnProtocol === 'QUIC'
                  ? styles.modeButtonActive
                  : styles.modeButtonInactive,
              ]}
              textStyles={styles.modeButtonText}
              title="QUIC"
              onPress={() =>
                setServer(prev => ({ ...prev, vpnProtocol: 'QUIC' }))
              }
            />
          </View>
        </View>
        <Text style={styles.sectionTitle}>Routing</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Mode: {routingMode}</Text>
          <View style={styles.rowButtons}>
            <TouchableOpacityButton
              touchableOpacityStyles={[
                styles.modeButton,
                routingMode === 'general'
                  ? styles.modeButtonActive
                  : styles.modeButtonInactive,
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
                routingMode === 'selective'
                  ? styles.modeButtonActive
                  : styles.modeButtonInactive,
              ]}
              textStyles={styles.modeButtonText}
              title="Selective"
              onPress={() => setRoutingMode('selective')}
            />
          </View>
        </View>
        <Text style={styles.inputDescription}>
          In most cases, "Selective" mode is recommended for better performance
          and battery life.
        </Text>
        <View style={styles.line} />
        <Text style={styles.inputLabel}>Remote Rules URL:</Text>
        <TextInput
          style={{ ...styles.input }}
          placeholder="https://..."
          value={remoteRoutingURL}
          onChangeText={setRemoteRoutingURL}
          autoCapitalize="none"
        />
        <Text style={styles.inputDescription}>
          * URL should point to a plain text file containing domain rules,
          separated by new lines.
        </Text>
        <View style={styles.line} />
        <Text style={styles.inputLabel}>Local Rules (one per line):</Text>
        <TextInput
          style={styles.multilineInput}
          placeholder="example.com, facebook.com"
          value={localRoutingRulesText}
          onChangeText={setLocalRoutingRulesText}
          autoCapitalize="none"
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.inputDescription}>
          * Domains listed here will be merged with the remote rules (if URL is
          provided) when you save.
        </Text>
        <View style={styles.line} />

        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            * Current rules:{' '}
            {rulesText.length ? rulesText.split('\n').length : 0}
          </Text>
          <TouchableOpacityButton
            touchableOpacityStyles={[styles.modeButton, styles.modeButtonWide]}
            textStyles={styles.modeButtonText}
            title="Reset"
            onPress={() => setRulesText('')}
          />
          <View style={styles.rowSpacer} />
          <TouchableOpacityButton
            touchableOpacityStyles={[styles.modeButton, styles.modeButtonWide]}
            textStyles={styles.modeButtonText}
            title="Save"
            onPress={async () => {
              const localRules = splitList(localRoutingRulesText);
              let remoteRules: string[] = [];
              if (remoteRoutingURL) {
                const remoteRoutingRulesText = await fetchRemoteURL(
                  remoteRoutingURL,
                );
                remoteRules = splitList(remoteRoutingRulesText);
              }
              const mergedRules = Array.from(
                new Set([...localRules, ...remoteRules]),
              );
              setRulesText(mergedRules.join('\n'));
            }}
          />
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
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
  inputDescription: { fontSize: 12, color: '#666', marginBottom: 12, textAlign: 'justify' },
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
  rowButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  rowSpacer: { width: 8 },
  line: { height: 1, backgroundColor: '#d9d9d9', marginVertical: 12 },
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
});
