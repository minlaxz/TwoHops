import React, { useCallback, useMemo, useState } from 'react';
import { Text, View, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MainScreen from '../components/views';
import { VpnClient } from '../services/vpn';
import type { QueryLogRow } from '../types';
import type { AppTheme } from '../theme/colors';
import { useAppTheme } from '../context/ThemeContext';

const MAX_LOG_ROWS = 250;

export default function DebugScreen() {
  const [logs, setLogs] = useState<QueryLogRow[]>([]);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribeLog = VpnClient.onQueryLog(row => {
        setLogs(prev => [row, ...prev].slice(0, MAX_LOG_ROWS));
      });

      return () => {
        unsubscribeLog();
      };
    }, []),
  );

  return (
    <MainScreen>
      <TrafficLogsScreen logs={logs} styles={styles} />
    </MainScreen>
  );
}

type DebugScreenStyles = ReturnType<typeof createStyles>;

type TrafficLogsScreenProps = {
  logs: QueryLogRow[];
  styles: DebugScreenStyles;
};

function toWildcardDomain(domain: string): string {
  const parts = domain.split('.');

  if (parts.length <= 2) {
    // example.com -> *.example.com
    return `*.${domain}`;
  }

  return `*.${parts.slice(-2).join('.')}`;
}

function TrafficLogsScreen({ logs, styles }: TrafficLogsScreenProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Traffic Logs</Text>
      <View style={styles.logScrollContainer}>
        <ScrollView
          style={styles.logScroll}
          contentContainerStyle={styles.logScrollContent}
          showsVerticalScrollIndicator
        >
          {logs.length === 0 ? (
            <Text style={styles.logEmpty}>
              No fetched traffic logs yet. Keep this screen open to collect
              real-time traffic logs.
            </Text>
          ) : null}
          {logs.map((log, index) => (
            <View
              style={styles.logRow}
              key={`${log.stamp.toISOString()}-${log.source}-${index}`}
            >
              <Text style={styles.logTitle}>
                {log.action.toUpperCase()} {log.protocol.toUpperCase()} Domain:{' '}
                {toWildcardDomain(log.domain ?? '-')}
              </Text>
              <Text style={styles.logLine}>
                {log.source} {'->'} {log.destination ?? 'unknown'}
              </Text>
              <Text style={styles.logTime}>{log.stamp.toISOString()}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: {
      flex: 1,
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
    logScrollContainer: {
      flex: 1,
    },
    logScroll: {
      flex: 1,
    },
    logScrollContent: {
      paddingBottom: 8,
    },
    logEmpty: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    logRow: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.logBorder,
    },
    logTitle: {
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 4,
      color: theme.colors.textPrimary,
    },
    logLine: {
      fontSize: 12,
      color: theme.colors.textPrimary,
    },
    logTime: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 6,
    },
  });
}
