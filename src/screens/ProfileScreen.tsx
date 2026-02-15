import React, { useMemo, useState } from 'react';
import { Alert, Text, StyleSheet, View, TextInput } from 'react-native';
import MainScreen from '../components/views';
import { TouchableOpacityButton } from '../components/buttons';
import { useSetupConfig } from '../context/SetupConfigContext';
import { splitList, fetchRemoteURL } from '../services/utils';
import { useAppTheme } from '../context/ThemeContext';
import type { AppTheme, ThemePreference } from '../theme/colors';

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
    localRoutingRulesText,
    setLocalRoutingRulesText,
    remoteRoutingURL,
    setRemoteRoutingURL,
    clearSetupConfig,
  } = useSetupConfig();
  const [url, setURL] = useState<string>('');
  const { theme, themePreference, setThemePreference } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const placeholderTextColor = theme.colors.placeholder;

  const themeOptions: ThemePreference[] = ['system', 'light', 'dark'];

  return (
    <MainScreen>
      <Text style={styles.title}>Configurations</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Theme: {themePreference}</Text>
        </View>
        <View style={styles.rowButtons}>
          {themeOptions.map(option => (
            <React.Fragment key={option}>
              <TouchableOpacityButton
                touchableOpacityStyles={[
                  styles.themeButton,
                  themePreference === option
                    ? styles.modeButtonActive
                    : styles.modeButtonInactive,
                ]}
                textStyles={styles.modeButtonText}
                title={option[0].toUpperCase() + option.slice(1)}
                onPress={() => setThemePreference(option)}
              />
              {option !== 'dark' ? <View style={styles.rowSpacer} /> : null}
            </React.Fragment>
          ))}
        </View>
        <Text style={styles.inputDescription}>
          Use "System" to follow your phone appearance settings.
        </Text>
        <View style={styles.line} />
        <Text style={styles.sectionTitle}>Simple</Text>
        <TextInput
          style={styles.input}
          placeholder="Single URL"
          placeholderTextColor={placeholderTextColor}
          value={url}
          onChangeText={setURL}
          autoCapitalize="none"
        />
        <Text style={styles.inputDescription}>
          This section is for users who want a quick setup without filling in
          individual fields. You can paste a single URL containing all necessary
          information, and the app will attempt to parse it to fill in the
          details automatically.
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
              const vpnProtocol =
                protocolParam === 'Http/2' ? 'Http/2' : 'QUIC';
              const dns = urlObj.searchParams.get('dns') ?? '';
              const remoteRulesURL =
                urlObj.searchParams.get('remoteRules') ?? '';

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
          placeholderTextColor={placeholderTextColor}
          value={server.name}
          onChangeText={value => setServer(prev => ({ ...prev, name: value }))}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Server IP Address"
          placeholderTextColor={placeholderTextColor}
          value={server.ipAddress}
          onChangeText={value =>
            setServer(prev => ({ ...prev, ipAddress: value }))
          }
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="TLS Domain Name"
          placeholderTextColor={placeholderTextColor}
          value={server.domain}
          onChangeText={value =>
            setServer(prev => ({ ...prev, domain: value }))
          }
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor={placeholderTextColor}
          value={server.login}
          onChangeText={value => setServer(prev => ({ ...prev, login: value }))}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, styles.passwordInput]}
          placeholder="Password"
          placeholderTextColor={placeholderTextColor}
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
          placeholderTextColor={placeholderTextColor}
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
          style={styles.input}
          placeholder="https://..."
          placeholderTextColor={placeholderTextColor}
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
          placeholderTextColor={placeholderTextColor}
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
          {/* <TouchableOpacityButton
            touchableOpacityStyles={[styles.modeButton, styles.modeButtonWide]}
            textStyles={styles.modeButtonText}
            title="Reset"
            onPress={() => setRulesText('')}
          /> */}
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
        <TouchableOpacityButton
          touchableOpacityStyles={[styles.modeButton, styles.clearButton]}
          textStyles={styles.modeButtonText}
          title="Clear Profile"
          onPress={() => {
            Alert.alert(
              'Clear profile?',
              'This removes saved server, DNS, and routing data from this device.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: () => {
                    clearSetupConfig().catch(error => {
                      console.error('Failed to clear setup config:', error);
                    });
                    setURL('');
                  },
                },
              ],
            );
          }}
        />
      </View>
    </MainScreen>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: {
      marginBottom: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
      color: theme.colors.textPrimary,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
      color: theme.colors.textPrimary,
    },
    inputLabel: {
      fontSize: 12,
      marginBottom: 4,
      color: theme.colors.textSecondary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.textPrimary,
    },
    inputDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 12,
      textAlign: 'justify',
    },
    passwordInput: {
      backgroundColor: theme.colors.inputBackgroundStrong,
      color: theme.colors.textPrimary,
    },
    multilineInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.textPrimary,
      minHeight: 100,
    },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    rowLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.textPrimary,
    },
    rowButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      overflow: 'hidden',
    },
    rowSpacer: { width: 8 },
    line: {
      height: 1,
      backgroundColor: theme.colors.divider,
      marginVertical: 12,
    },
    modeButton: {
      width: 70,
      height: 40,
      padding: 4,
    },
    themeButton: {
      width: 90,
      height: 40,
      padding: 4,
    },
    modeButtonWide: {
      width: 80,
    },
    clearButton: {
      width: '100%',
      backgroundColor: theme.colors.danger,
      marginTop: 8,
    },
    protocolButton: {
      width: 60,
      height: 40,
      padding: 4,
    },
    modeButtonActive: {
      backgroundColor: theme.colors.buttonPrimary,
    },
    modeButtonInactive: {
      backgroundColor: theme.colors.buttonInactive,
    },
    modeButtonText: {
      color: theme.colors.buttonPrimaryText,
      fontSize: 12,
    },
  });
}
