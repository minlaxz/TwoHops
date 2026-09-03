import React, { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Text, View, FlatList, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';
import PressableScale from '../components/PressableScale';
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
  // Rows already buffered when the screen opens mount in place; only rows
  // that arrive afterwards get the entry animation (issue #97). One
  // watermark for both segments, so a segment switch does not re-animate.
  const mountedAt = useRef(Date.now()).current;

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
            <PressableScale
              testID="logs-clear"
              accessibilityRole="button"
              style={styles.clearButton}
              onPress={() =>
                (shownSegment === 'traffic' ? trafficLogs : debugLogs).clear()
              }
            >
              <Text style={styles.clearLabel}>Clear</Text>
            </PressableScale>
          ) : null}
        </View>
        <View style={styles.logScrollContainer}>
          {shownSegment === 'traffic' ? (
            <TrafficRows logs={traffic} styles={styles} mountedAt={mountedAt} />
          ) : (
            <DebugRows logs={debug} styles={styles} mountedAt={mountedAt} />
          )}
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
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.segment, active && styles.segmentActive]}
      onPress={onPress}
    >
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
        {label}
      </Text>
    </PressableScale>
  );
}

// The buffers prepend (newest-first) and rows carry no id, so index-based
// keys would shift on every append and remount (re-animate) the whole list.
// Identity of the row object is stable inside the buffer; key off that.
let nextRowKey = 1;
const rowKeys = new WeakMap<object, string>();
function rowKey(row: object): string {
  let key = rowKeys.get(row);
  if (key === undefined) {
    key = String(nextRowKey++);
    rowKeys.set(row, key);
  }
  return key;
}

// A row animates in at most once. FlatList virtualisation remounts rows that
// scroll back into view and a segment switch remounts the whole list; without
// this every post-mount row would replay its entry each time (issue #97).
const animatedRows = new WeakSet<object>();
function shouldAnimate(row: object, stamp: Date, mountedAt: number): boolean {
  if (stamp.getTime() <= mountedAt || animatedRows.has(row)) {
    return false;
  }
  animatedRows.add(row);
  return true;
}

/** Fades and slides a freshly mounted log row into place (issue #70). It is
 * decoration, so reduce-motion mounts the row in place (issue #80). */
function AnimatedLogRow({
  style,
  animate,
  children,
}: {
  style: LogsScreenStyles['logRow'];
  /** False mounts in place: rows that pre-date the screen (issue #97). */
  animate: boolean;
  children: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      style={style}
      entering={
        reduceMotion || !animate
          ? undefined
          : FadeInDown.duration(theme.motion.duration.fast)
      }
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

type LogRowsProps<T extends object> = {
  testID: string;
  logs: readonly T[];
  styles: LogsScreenStyles;
  /** Screen mount time (ms); rows stamped after it animate in. */
  mountedAt: number;
  emptyText: string;
  stampOf: (row: T) => Date;
  renderBody: (row: T) => React.ReactNode;
};

// FlatList renders only the visible window; a ScrollView + map mounted every
// buffered row (up to 250) at once, which is what made opening the tab slow
// on low-end devices (issue #97).
function LogRows<T extends object>({
  testID,
  logs,
  styles,
  mountedAt,
  emptyText,
  stampOf,
  renderBody,
}: LogRowsProps<T>) {
  return (
    <FlatList
      testID={testID}
      style={styles.logScroll}
      contentContainerStyle={styles.logScrollContent}
      showsVerticalScrollIndicator
      data={logs}
      keyExtractor={rowKey}
      ListEmptyComponent={<Text style={styles.logEmpty}>{emptyText}</Text>}
      renderItem={({ item: log }) => (
        <AnimatedLogRow
          style={styles.logRow}
          animate={shouldAnimate(log, stampOf(log), mountedAt)}
        >
          {renderBody(log)}
        </AnimatedLogRow>
      )}
    />
  );
}

type RowsProps<T extends object> = Pick<
  LogRowsProps<T>,
  'logs' | 'styles' | 'mountedAt'
>;

function TrafficRows(props: RowsProps<QueryLogRow>) {
  const { styles } = props;
  return (
    <LogRows
      {...props}
      testID="logs-traffic-list"
      emptyText="No Traffic Logs yet. Rows collect while the tunnel is running."
      stampOf={log => log.stamp}
      renderBody={log => (
        <>
          <Text style={styles.logTitle}>
            {log.action.toUpperCase()} {log.protocol.toUpperCase()} Domain:{' '}
            {toWildcardDomain(log.domain ?? '-')}
          </Text>
          <Text style={styles.logLine}>
            {log.source} {'->'} {log.destination ?? 'unknown'}
          </Text>
          <Text style={styles.logTime}>{log.stamp.toISOString()}</Text>
        </>
      )}
    />
  );
}

function DebugRows(props: RowsProps<DebugEntry>) {
  const { styles } = props;
  return (
    <LogRows
      {...props}
      testID="logs-debug-list"
      emptyText="No Debug Logs yet."
      stampOf={log => log.at}
      renderBody={log => (
        <>
          <Text style={styles.logLine}>{log.message}</Text>
          <Text style={styles.logTime}>{log.at.toISOString()}</Text>
        </>
      )}
    />
  );
}

function createStyles(theme: AppTheme) {
  const { colors, spacing, radius, typography, card } = theme;
  return StyleSheet.create({
    screen: {
      flex: 1,
      padding: spacing.lg,
      backgroundColor: colors.background,
    },
    section: {
      flex: 1,
      padding: spacing.lg,
      borderRadius: radius.md,
      ...card,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    segmentRow: {
      flex: 1,
      flexDirection: 'row',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    clearButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    clearLabel: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    segment: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    segmentActive: {
      backgroundColor: colors.buttonPrimary,
    },
    segmentLabel: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    segmentLabelActive: {
      color: colors.buttonPrimaryText,
    },
    logScrollContainer: {
      flex: 1,
    },
    logScroll: {
      flex: 1,
    },
    logScrollContent: {
      paddingBottom: spacing.sm,
    },
    logEmpty: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    logRow: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.logBorder,
    },
    logTitle: {
      ...typography.caption,
      fontWeight: '600',
      marginBottom: spacing.xs,
      color: colors.textPrimary,
    },
    logLine: {
      ...typography.caption,
      color: colors.textPrimary,
    },
    logTime: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
  });
}
