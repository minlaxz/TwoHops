import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Animated,
  Text,
  View,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useLogs } from '../context/LogsContext';
import { useLogSettings } from '../context/LogSettingsContext';
import { useTunnelSession } from '../context/TunnelSessionContext';
import { displayState } from '../services/tunnelSession';
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
  const { debugLoggingEnabled, trafficLoggingEnabled } = useLogSettings();
  const { snapshot } = useTunnelSession();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // A segment tab hides when its logging toggle is OFF (issue #69); fall
  // back to the visible one so the sticky selection never shows a hidden tab.
  const noneEnabled = !debugLoggingEnabled && !trafficLoggingEnabled;
  const shownSegment: Segment =
    segment === 'traffic' && !trafficLoggingEnabled
      ? 'debug'
      : segment === 'debug' && !debugLoggingEnabled
      ? 'traffic'
      : segment;

  if (noneEnabled) {
    return (
      <View style={styles.screen}>
        <View style={styles.section}>
          <Text style={styles.logEmpty} testID="logs-disabled-placeholder">
            {displayState(snapshot.state) === 'running'
              ? 'Here I stand :)'
              : 'Logging is turned off. Enable Debug or Traffic Logging in Settings.'}
          </Text>
        </View>
      </View>
    );
  }

  // Not MainScreen: nesting this card's ScrollView inside MainScreen's
  // same-axis ScrollView unbounds the card, pushing its bottom edge below
  // the fold. A plain flex View clamps the card to the viewport instead.
  return (
    <View style={styles.screen}>
      <View style={styles.section}>
        <View style={styles.toolbar}>
          <View style={styles.segmentRow}>
            {trafficLoggingEnabled ? (
              <SegmentButton
                label="Traffic"
                testID="logs-segment-traffic"
                active={shownSegment === 'traffic'}
                onPress={() => setSegment('traffic')}
                styles={styles}
              />
            ) : null}
            {debugLoggingEnabled ? (
              <SegmentButton
                label="Debug"
                testID="logs-segment-debug"
                active={shownSegment === 'debug'}
                onPress={() => setSegment('debug')}
                styles={styles}
              />
            ) : null}
          </View>
          {(shownSegment === 'traffic' ? traffic : debug).length > 0 ? (
            <Pressable
              testID="logs-clear"
              accessibilityRole="button"
              style={styles.clearButton}
              onPress={() =>
                (shownSegment === 'traffic' ? trafficLogs : debugLogs).clear()
              }
            >
              <Text style={styles.clearLabel}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.logScrollContainer}>
          <ScrollView
            style={styles.logScroll}
            contentContainerStyle={styles.logScrollContent}
            showsVerticalScrollIndicator
          >
            {shownSegment === 'traffic' ? (
              <TrafficRows logs={traffic} styles={styles} />
            ) : (
              <DebugRows logs={debug} styles={styles} />
            )}
          </ScrollView>
        </View>
      </View>
    </View>
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

// The buffers prepend (newest-first) and rows carry no id, so index-based
// keys would shift on every append and remount (re-animate) the whole list.
// Identity of the row object is stable inside the buffer; key off that.
let nextRowKey = 1;
const rowKeys = new WeakMap<object, number>();
function rowKey(row: object): number {
  let key = rowKeys.get(row);
  if (key === undefined) {
    key = nextRowKey++;
    rowKeys.set(row, key);
  }
  return key;
}

/** Fades and slides a freshly mounted log row into place (issue #70). */
function AnimatedLogRow({
  style,
  children,
}: {
  style: LogsScreenStyles['logRow'];
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [progress]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
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
      {logs.map(log => (
        <AnimatedLogRow style={styles.logRow} key={rowKey(log)}>
          <Text style={styles.logTitle}>
            {log.action.toUpperCase()} {log.protocol.toUpperCase()} Domain:{' '}
            {toWildcardDomain(log.domain ?? '-')}
          </Text>
          <Text style={styles.logLine}>
            {log.source} {'->'} {log.destination ?? 'unknown'}
          </Text>
          <Text style={styles.logTime}>{log.stamp.toISOString()}</Text>
        </AnimatedLogRow>
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
      {logs.map(log => (
        <AnimatedLogRow style={styles.logRow} key={rowKey(log)}>
          <Text style={styles.logLine}>{log.message}</Text>
          <Text style={styles.logTime}>{log.at.toISOString()}</Text>
        </AnimatedLogRow>
      ))}
    </>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      padding: 24,
      backgroundColor: theme.colors.background,
    },
    section: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    segmentRow: {
      flex: 1,
      flexDirection: 'row',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    clearButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    clearLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textPrimary,
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
