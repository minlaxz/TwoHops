import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Text, View, ScrollView, StyleSheet, Pressable } from 'react-native';
import MainScreen from '../components/views';
import { useLogs } from '../context/LogsContext';
import type { DebugEntry } from '../services/tunnelSession';
import type { QueryLogRow } from '../types';
import type { AppTheme } from '../theme/colors';
import { useAppTheme } from '../context/ThemeContext';

type Segment = 'traffic' | 'debug';

export default function LogsScreen() {
  const { trafficLogs, debugLogs } = useLogs();
  const [segment, setSegment] = useState<Segment>('traffic');
  const traffic = useSyncExternalStore(
    trafficLogs.subscribe,
    trafficLogs.getRows,
  );
  const debug = useSyncExternalStore(debugLogs.subscribe, debugLogs.getRows);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <MainScreen>
      <View style={styles.section}>
        <View style={styles.segmentRow}>
          <SegmentButton
            label="Traffic"
            testID="logs-segment-traffic"
            active={segment === 'traffic'}
            onPress={() => setSegment('traffic')}
            styles={styles}
          />
          <SegmentButton
            label="Debug"
            testID="logs-segment-debug"
            active={segment === 'debug'}
            onPress={() => setSegment('debug')}
            styles={styles}
          />
        </View>
        <View style={styles.logScrollContainer}>
          <ScrollView
            style={styles.logScroll}
            contentContainerStyle={styles.logScrollContent}
            showsVerticalScrollIndicator
          >
            {segment === 'traffic' ? (
              <TrafficRows logs={traffic} styles={styles} />
            ) : (
              <DebugRows logs={debug} styles={styles} />
            )}
          </ScrollView>
        </View>
      </View>
    </MainScreen>
  );
}

type LogsScreenStyles = ReturnType<typeof createStyles>;

type SegmentButtonProps = {
  label: string;
  testID: string;
  active: boolean;
  onPress: () => void;
  styles: LogsScreenStyles;
};

function SegmentButton({
  label,
  testID,
  active,
  onPress,
  styles,
}: SegmentButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.segment, active && styles.segmentActive]}
      onPress={onPress}
    >
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function toWildcardDomain(domain: string): string {
  const parts = domain.split('.');

  if (parts.length <= 2) {
    // example.com -> *.example.com
    return `*.${domain}`;
  }

  return `*.${parts.slice(-2).join('.')}`;
}

function TrafficRows({
  logs,
  styles,
}: {
  logs: readonly QueryLogRow[];
  styles: LogsScreenStyles;
}) {
  return (
    <>
      {logs.length === 0 ? (
        <Text style={styles.logEmpty}>
          No Traffic Logs yet. Rows collect while the tunnel is running.
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
    </>
  );
}

function DebugRows({
  logs,
  styles,
}: {
  logs: readonly DebugEntry[];
  styles: LogsScreenStyles;
}) {
  return (
    <>
      {logs.length === 0 ? (
        <Text style={styles.logEmpty}>No Debug Logs yet.</Text>
      ) : null}
      {logs.map((log, index) => (
        <View style={styles.logRow} key={`${log.at.toISOString()}-${index}`}>
          <Text style={styles.logLine}>{log.message}</Text>
          <Text style={styles.logTime}>{log.at.toISOString()}</Text>
        </View>
      ))}
    </>
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
    segmentRow: {
      flexDirection: 'row',
      marginBottom: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    segmentActive: {
      backgroundColor: theme.colors.buttonPrimary,
    },
    segmentLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    segmentLabelActive: {
      color: theme.colors.buttonPrimaryText,
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
