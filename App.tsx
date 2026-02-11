/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

// import React, { useEffect, useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// import { VpnClient, type RoutingConfig, type QueryLogRow, type ServerConfig, type VpnManagerState } from './src/services';
// import { splitList } from './src/services/utils';
import InternalApp from './src/screens/App';

// type CustomButtonProps = {
//   title: string;
//   onPress: () => void;
//   disabled?: boolean;
// };

// type State = {
//   emoji: string;
//   action: () => Promise<void>;
//   actionText?: string;
// }

// type CurrentState = {
//   loading: boolean;
//   state: VpnManagerState | null;
//   error: string | null;
// }

// type ScreenName = 'vpn' | 'queryLogs';

// const CustomButton: React.FC<CustomButtonProps> = ({ title, onPress, disabled }) => {
//   return (
//     <TouchableOpacity style={styles.button} onPress={onPress} disabled={disabled}>
//       <Text style={styles.buttonText}>{title}</Text>
//     </TouchableOpacity>
//   );
// };

// const CustomLinkButton: React.FC<CustomButtonProps> = ({ title, onPress }) => {
//   return (
//     <TouchableOpacity onPress={onPress}>
//       <Text style={styles.link}>{title}</Text>
//     </TouchableOpacity>
//   );
// };

// type RoutingMode = RoutingConfig['mode'];

// const fetchRemoteURL = async (url: string): Promise<string> => {
//   try {
//     const response = await fetch(url);
//     if (!response.ok) {
//       throw new Error(`Failed to fetch routing rules: ${response.statusText}`);
//     }
//     return (await response.text()).replace(/\r/g, '').replace("\n", ",");
//   } catch (error) {
//     console.error('Error fetching remote routing rules:', error);
//     return '';
//   }
// }

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'dark-content' : 'light-content'} />
      <InternalApp />
    </SafeAreaProvider>
  );
}

// function AppContent() {
//   const [state, setState] = useState<VpnManagerState>('disconnected');
//   const [queryLogs, setQueryLogs] = useState<QueryLogRow[]>([]);
//   const [screenName, setScreenName] = useState<ScreenName>('vpn');

//   const [server, setServer] = useState<ServerConfig>({
//     name: 'lssg',
//     ipAddress: '13.251.208.16',
//     domain: 'trusted-1.minlaxz.lol',
//     login: 'minlaxz',
//     password: '000111222.@gG',
//     vpnProtocol: 'QUIC',
//     dnsServers: [],
//   });

//   const [routingMode, setRoutingMode] = useState<RoutingMode>('selective');
//   const [localRoutingRulesText, setLocalRoutingRulesText] = useState<string>('myip.wtf');
//   const [remoteRoutingRulesText, setRemoteRoutingRulesText] = useState<string>('');
//   const [remoteRoutingURL, setRemoteRoutingURL] = useState<string>('https://pastebin.com/raw/hHdVMwyW');
//   const [dnsServersText, setDnsServersText] = useState<string>('https://dns.nextdns.io/bafda8/minlaxzemulator-ttrn');
//   const [showServerSection, setShowServerSection] = useState<boolean>(false);

//   const handleConnect = async () => {

//     const rules = splitList(localRoutingRulesText);
//     if (remoteRoutingURL && remoteRoutingRulesText.length === 0) {
//       fetchRemoteURL(remoteRoutingURL).then((text) => {
//         setRemoteRoutingRulesText(text);
//       });
//     }
//     const remoteRules = splitList(remoteRoutingRulesText);
//     const uniqueRules = remoteRules.filter(rule => !rules.includes(rule));
//     const routing: RoutingConfig = {
//       mode: routingMode,
//       rules: uniqueRules,
//     };

//     const updatedServer: ServerConfig = {
//       ...server,
//       dnsServers: splitList(dnsServersText),
//     };

//     await VpnClient.start({
//       server: updatedServer, routing, excludedRoutes: []
//     });

//   };

//   const handleDisconnect = async () => {
//     await VpnClient.stop();
//   };

//   const handleUpdateConfig = async () => {
//     const routing: RoutingConfig = {
//       mode: routingMode,
//       rules: splitList(localRoutingRulesText),
//     };

//     const updatedServer: ServerConfig = {
//       ...server,
//       dnsServers: splitList(dnsServersText),
//     };

//     await VpnClient.updateConfiguration({
//       server: updatedServer, routing, excludedRoutes: []
//     });
//   }

//   useEffect(() => {
//     let active = true;

//     VpnClient.getCurrentState().then((value) => {
//       if (active) {
//         setState(value);
//       }
//     });

//     const unsubscribeState = VpnClient.onState((value) => {
//       setState(value);
//     });

//     const unsubscribeLog = VpnClient.onQueryLog((row) => {
//       setQueryLogs((prev) => [row, ...prev].slice(0, 200));
//     });

//     return () => {
//       active = false;
//       unsubscribeState();
//       unsubscribeLog();
//     };
//   }, []);

//   const states: Record<VpnManagerState, State> = {
//     "connected": { emoji: "🔗", action: handleDisconnect, actionText: "Disconnect" },
//     "connecting": { emoji: "⏳", action: async () => { }, actionText: "Connecting..." },
//     "disconnected": { emoji: "⛓️‍💥", action: handleConnect, actionText: "Connect" },
//     "waitingForRecovery": { emoji: "🛟", action: async () => { } },
//     "waitingForNetwork": { emoji: "📡", action: async () => { } },
//     "recovering": { emoji: "🔄", action: async () => { } },
//   };

//   if (screenName === 'queryLogs') {
//     return <QueryLogsScreen logs={queryLogs} onBack={() => setScreenName('vpn')} />;
//   }

//   const latestLog = queryLogs[0];
//   const latestLogText = latestLog
//     ? `${latestLog.action.toUpperCase()} ${latestLog.source} -> ${latestLog.destination ?? 'unknown'}`
//     : 'No logs yet';

//   return (
//     <ScrollView contentContainerStyle={styles.container}>
//       <Text style={styles.title}>VPN State: {states[state]["emoji"]}</Text>
//       <Text style={styles.subtitle}>{latestLogText}</Text>

//       <View style={styles.section}>
//         <CustomLinkButton
//           title={`Open Query Logs (${queryLogs.length})`}
//           onPress={() => setScreenName('queryLogs')}
//         />
//       </View>

//       <View style={styles.section}>
//         <CustomLinkButton
//           title={showServerSection === true ? "Hide Server Detail" : "Show Server Detail"}
//           onPress={() => setShowServerSection(!showServerSection)}
//         />
//       </View>
//       {
//         showServerSection &&
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>Server</Text>
//           {/* <TextInput
//             style={styles.input}
//             placeholder="Server Name (any)"
//             value={server.name}
//             onChangeText={(value) => setServer((prev) => ({ ...prev, name: value }))}
//           /> */}
//           <TextInput
//             style={styles.input}
//             placeholder="Server IP Address"
//             value={server.ipAddress}
//             onChangeText={(value) => setServer((prev) => ({ ...prev, ipAddress: value }))}
//             autoCapitalize="none"
//           />
//           <TextInput
//             style={styles.input}
//             placeholder="TLS Domain Name"
//             value={server.domain}
//             onChangeText={(value) => setServer((prev) => ({ ...prev, domain: value }))}
//             autoCapitalize="none"
//           />
//           <TextInput
//             style={styles.input}
//             placeholder="Username"
//             value={server.login}
//             onChangeText={(value) => setServer((prev) => ({ ...prev, login: value }))}
//             autoCapitalize="none"
//           />
//           <TextInput
//             style={styles.input}
//             placeholder="Password"
//             value={server.password}
//             onChangeText={(value) => setServer((prev) => ({ ...prev, password: value }))}
//             secureTextEntry
//           />
//           <Text style={styles.inputLabel}>DNS Servers:</Text>
//           <TextInput
//             style={styles.input}
//             placeholder="DNS Servers (comma-separated)"
//             value={dnsServersText}
//             onChangeText={setDnsServersText}
//             autoCapitalize="none"
//           />
//           <View style={styles.row}>
//             <Text style={styles.rowLabel}>Protocol: {server.vpnProtocol}</Text>
//             <View style={styles.rowButtons}>
//               <Button
//                 title="Http/2"
//                 onPress={() => setServer((prev) => ({ ...prev, vpnProtocol: 'Http/2' }))}
//               />
//               <View style={styles.rowSpacer} />
//               <Button
//                 title="QUIC"
//                 onPress={() => setServer((prev) => ({ ...prev, vpnProtocol: 'QUIC' }))}
//               />
//             </View>
//           </View>
//         </View>
//       }

//       <View style={styles.section}>
//         <View style={styles.row}>
//           <View style={styles.rowButtons}>
//             <Text style={styles.rowLabel}>Routing mode: {routingMode}</Text>
//             {
//               routingMode === 'general'
//                 ?
//                 (
//                   <CustomLinkButton
//                     title="Excluded"
//                     onPress={() => setRoutingMode('selective')}
//                   />
//                 )
//                 :
//                 (
//                   <CustomLinkButton
//                     title="Included"
//                     onPress={() => setRoutingMode('general')}
//                   />
//                 )
//             }
//           </View>
//         </View>
//         <Text style={styles.inputLabel}>Rules: Remote URL</Text>
//         <TextInput
//           style={styles.input}
//           placeholder="Rules: Remote URL"
//           value={remoteRoutingURL}
//           onChangeText={setRemoteRoutingURL}
//           autoCapitalize="none"
//         />
//         <Text style={styles.inputLabel}>Rules: Local</Text>
//         <TextInput
//           style={styles.input}
//           placeholder="Rules: Local (comma-separated)"
//           value={localRoutingRulesText}
//           onChangeText={setLocalRoutingRulesText}
//           autoCapitalize="none"
//         />
//       </View>
//       <View style={styles.buttonContainer}>
//         <CustomButton
//           disabled={state === "connecting"}
//           title={states[state]["actionText"] || "Unknown State"}
//           onPress={states[state]["action"]} />
//       </View>
//       <View style={styles.debugView}>
//         <Text style={styles.debugText}>{JSON.stringify({ routingMode, localRoutingRulesText, remoteRoutingRulesText }, null, 2)}</Text>
//       </View>
//     </ScrollView>
//   );
// }

// type QueryLogsScreenProps = {
//   logs: QueryLogRow[];
//   onBack: () => void;
// };

// function QueryLogsScreen({ logs, onBack }: QueryLogsScreenProps) {
//   return (
//     <ScrollView contentContainerStyle={styles.container}>
//       <View>
//         <CustomLinkButton title="Back to VPN Screen" onPress={onBack} />
//       </View>

//       <View style={styles.section}>
//         <Text style={styles.sectionTitle}>Query Logs</Text>
//         {logs.length === 0 ? <Text style={styles.logEmpty}>No query logs yet.</Text> : null}
//         {logs.map((log, index) => (
//           <View style={styles.logRow} key={`${log.stamp.toISOString()}-${log.source}-${index}`}>
//             <Text style={styles.logTitle}>{log.action.toUpperCase()} {log.protocol.toUpperCase()}</Text>
//             <Text style={styles.logLine}>Source: {log.source}</Text>
//             <Text style={styles.logLine}>Destination: {log.destination ?? 'unknown'}</Text>
//             <Text style={styles.logLine}>Domain: {log.domain ?? '-'}</Text>
//             <Text style={styles.logTime}>{log.stamp.toISOString()}</Text>
//           </View>
//         ))}
//       </View>
//     </ScrollView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     padding: 24,
//     backgroundColor: '#f5f5f5',
//     alignItems: 'stretch',
//   },
//   title: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
//   subtitle: { fontSize: 14, marginBottom: 20, textAlign: 'center' },
//   section: {
//     marginBottom: 16,
//     padding: 16,
//     borderRadius: 12,
//     backgroundColor: '#ffffff',
//   },
//   sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
//   inputLabel: { fontSize: 12, marginBottom: 4 },
//   input: {
//     borderWidth: 1,
//     borderColor: '#d9d9d9',
//     borderRadius: 8,
//     paddingHorizontal: 12,
//     paddingVertical: 10,
//     marginBottom: 12,
//     backgroundColor: '#fff',
//   },
//   row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
//   rowLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
//   rowButtons: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, overflow: 'hidden' },
//   rowSpacer: { width: 8 },
//   buttonContainer: { marginBottom: 12, borderRadius: 8, overflow: 'hidden' },
//   button: {
//     height: 50,
//     width: "100%",
//     // Grey when disabled, blue otherwise
//     backgroundColor: '#5bb1cb',
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderRadius: 8,
//     padding: 10,
//   },
//   buttonText: {
//     color: 'white',
//     fontSize: 18,
//     fontWeight: 'bold',
//   },
//   link: {
//     color: '#5bb1cb',
//     textDecorationLine: 'underline',
//     textDecorationColor: '#5bb1cb',
//   },
//   debugView: {
//     marginTop: 20,
//     padding: 10,
//     backgroundColor: '#e0e0e0',
//     borderRadius: 8,
//   },
//   debugText: {
//     fontSize: 12,
//     color: '#333',
//   },
//   logEmpty: {
//     fontSize: 14,
//     color: '#666',
//   },
//   logRow: {
//     padding: 10,
//     borderRadius: 8,
//     borderWidth: 1,
//     borderColor: '#d9d9d9',
//     marginBottom: 10,
//     backgroundColor: '#fff',
//   },
//   logTitle: {
//     fontSize: 13,
//     fontWeight: '700',
//     marginBottom: 4,
//   },
//   logLine: {
//     fontSize: 12,
//     color: '#333',
//   },
//   logTime: {
//     fontSize: 11,
//     color: '#666',
//     marginTop: 6,
//   },
// });

export default App;
