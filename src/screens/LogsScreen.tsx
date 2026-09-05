import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Text, View, FlatList, StyleSheet } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, {
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';
import PressableScale from '../components/PressableScale';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { useLogs } from '../context/LogsContext';
import { useLogSettings } from '../context/LogSettingsContext';
import { useTunnelSession } from '../context/TunnelSessionContext';
import { useSetupProfile } from '../context/SetupProfileContext';
import { useAppToast } from '../components/AppToast';
import { displayState } from '../services/tunnelSession';
import { addLocalRule, offerableLocalRule } from '../services/setupProfile';
import { registrableDomain } from '../services/routingRules';
import { probeDirect } from '../services/directProbe';
import type { ProbeResult } from '../services/directProbe';
import type { DebugEntry } from '../services/tunnelSession';
import { CORE_LOG_LEVELS, CORE_LOG_TAGS } from '../services/coreLog';
import type { CoreLogRow } from '../services/coreLog';
import type { QueryLogRow } from '../types';
import type { AppTheme } from '../theme/colors';
import { useAppTheme } from '../context/ThemeContext';

type Segment = 'traffic' | 'debug' | 'core';

export default function LogsScreen() {
  const { trafficLogs, debugLogs, coreLogs } = useLogs();
  const [segment, setSegment] = useState<Segment>('traffic');
  const traffic = useSyncExternalStore(
    trafficLogs.subscribe,
    trafficLogs.getRows,
  );
  const debug = useSyncExternalStore(debugLogs.subscribe, debugLogs.getRows);
  const core = useSyncExternalStore(coreLogs.subscribe, coreLogs.getRows);
  const { debugLoggingEnabled, trafficLoggingEnabled, coreLoggingEnabled } =
    useLogSettings();
  const { snapshot } = useTunnelSession();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Rows already buffered when the screen opens mount in place; only rows
  // that arrive afterwards get the entry animation (issue #97). One
  // watermark for both segments, so a segment switch does not re-animate.
  const mountedAt = useRef(Date.now()).current;

  // A segment tab hides when its logging toggle is OFF (issue #69); fall
  // back to the visible one so the sticky selection never shows a hidden tab.
  const enabled: Record<Segment, boolean> = {
    traffic: trafficLoggingEnabled,
    debug: debugLoggingEnabled,
    core: coreLoggingEnabled,
  };
  const segments = (['traffic', 'debug', 'core'] as const).filter(
    s => enabled[s],
  );
  const noneEnabled = segments.length === 0;
  const shownSegment: Segment = enabled[segment] ? segment : segments[0];
  const rows = { traffic, debug, core }[shownSegment];
  const buffers = { traffic: trafficLogs, debug: debugLogs, core: coreLogs };

  if (noneEnabled) {
    return (
      <View style={styles.screen}>
        <View style={styles.section}>
          <Text style={styles.logEmpty} testID="logs-disabled-placeholder">
            {displayState(snapshot.state) === 'running'
              ? 'Here I stand :)'
              : 'Logging is turned off. Enable Debug, Traffic or Core Logging in Settings.'}
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
            {coreLoggingEnabled ? (
              <SegmentButton
                label="Core"
                testID="logs-segment-core"
                active={shownSegment === 'core'}
                onPress={() => setSegment('core')}
                styles={styles}
              />
            ) : null}
          </View>
          {rows.length > 0 ? (
            <PressableScale
              testID="logs-clear"
              accessibilityRole="button"
              style={styles.clearButton}
              onPress={() => buffers[shownSegment].clear()}
            >
              <Text style={styles.clearLabel}>Clear</Text>
            </PressableScale>
          ) : null}
        </View>
        {shownSegment === 'traffic' ? (
          <TrafficRows logs={traffic} styles={styles} mountedAt={mountedAt} />
        ) : shownSegment === 'debug' ? (
          <DebugRows logs={debug} styles={styles} mountedAt={mountedAt} />
        ) : (
          <CoreRows logs={core} styles={styles} mountedAt={mountedAt} />
        )}
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
  return `*.${registrableDomain(domain)}`;
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
  const list = useRef<FlatList<T>>(null);
  // Scroll-to-top shows once the list is more than a screen down (#103).
  const [farDown, setFarDown] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement } = e.nativeEvent;
    setFarDown(contentOffset.y > layoutMeasurement.height);
  };
  return (
    <View style={styles.logScrollContainer}>
      <FlatList
        ref={list}
        testID={testID}
        style={styles.logScroll}
        contentContainerStyle={styles.logScrollContent}
        showsVerticalScrollIndicator
        onScroll={onScroll}
        scrollEventThrottle={100}
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
      <ScrollToTopButton
        testID="logs-scroll-top"
        visible={farDown && logs.length > 0}
        onPress={() =>
          list.current?.scrollToOffset({ offset: 0, animated: true })
        }
      />
    </View>
  );
}

type RowsProps<T extends object> = Pick<
  LogRowsProps<T>,
  'logs' | 'styles' | 'mountedAt'
>;

function TrafficRows(props: RowsProps<QueryLogRow>) {
  const { styles } = props;
  const { profile, selectedId, saveProfile } = useSetupProfile();
  const { trafficLogs } = useLogs();
  const toast = useAppToast();
  // Direct Probe verdicts per row (#99), keyed like the list. On-demand only;
  // never probe every bypassed domain automatically.
  const [probes, setProbes] = useState<Record<string, ProbeResult | 'testing'>>(
    {},
  );
  // Clear drops the rows, so drop their verdicts too.
  useEffect(
    () =>
      trafficLogs.subscribe(() => {
        if (trafficLogs.getRows().length === 0) {
          setProbes({});
        }
      }),
    [trafficLogs],
  );
  const testDirect = async (row: QueryLogRow, domain: string) => {
    const key = rowKey(row);
    setProbes(prev => ({ ...prev, [key]: 'testing' }));
    const result = await probeDirect(domain);
    setProbes(prev => ({ ...prev, [key]: result }));
  };
  // One-tap add of a bypassed domain to the Selected Profile's Local Rules
  // (issue #98). Eligibility lives in `offerableLocalRule`.
  const addRule = (rule: string) => {
    const next = addLocalRule(profile, rule);
    if (selectedId === null || next === profile) {
      return;
    }
    saveProfile(selectedId, next);
    // Android `updateConfiguration` is a no-op; the user reconnects.
    toast('Added. Reconnect to apply.');
  };
  return (
    <LogRows
      {...props}
      testID="logs-traffic-list"
      emptyText="No Traffic Logs yet. Rows collect while the tunnel is running."
      stampOf={log => log.stamp}
      renderBody={log => {
        const rule =
          selectedId === null ? null : offerableLocalRule(profile, log);
        const probe = probes[rowKey(log)];
        const domain = log.domain ?? '';
        return (
          <>
            <Text style={styles.logTitle}>
              {log.action.toUpperCase()} {log.protocol.toUpperCase()} Domain:{' '}
              {toWildcardDomain(log.domain ?? '-')}
            </Text>
            <Text style={styles.logLine}>
              {log.source} {'->'} {log.destination ?? 'unknown'}
            </Text>
            <Text style={styles.logTime}>{log.stamp.toISOString()}</Text>
            {rule !== null ? (
              <RowControl
                domain={domain}
                rule={rule}
                probe={probe}
                styles={styles}
                onTest={() => testDirect(log, domain)}
                onAdd={() => addRule(rule)}
              />
            ) : null}
          </>
        );
      }}
    />
  );
}

// One control per bypassed row (#103): the probe while idle/testing, the
// Add offer only after a failed probe, nothing but the verdict on success.
function RowControl({
  domain,
  rule,
  probe,
  styles,
  onTest,
  onAdd,
}: {
  domain: string;
  /** The Local Rule Add would append (collapsed domain). */
  rule: string;
  probe: ProbeResult | 'testing' | undefined;
  styles: LogsScreenStyles;
  onTest: () => void;
  onAdd: () => void;
}) {
  if (probe === 'works') {
    return <Text style={styles.probeVerdict}>Direct works.</Text>;
  }
  if (probe === 'failed') {
    return (
      <>
        <Text style={styles.probeVerdict}>Direct failed.</Text>
        <PressableScale
          testID={`logs-add-rule-${rule}`}
          accessibilityRole="button"
          accessibilityLabel={`Add ${rule} to Local Rules`}
          style={styles.addRuleButton}
          onPress={onAdd}
        >
          <Text style={styles.addRuleLabel}>Add to Local Rules</Text>
        </PressableScale>
      </>
    );
  }
  const testing = probe === 'testing';
  return (
    <PressableScale
      testID={`logs-test-direct-${domain}`}
      accessibilityRole="button"
      accessibilityLabel={`Test direct connection to ${domain}`}
      accessibilityState={{ busy: testing }}
      disabled={testing}
      style={styles.addRuleButton}
      onPress={onTest}
    >
      <Text style={styles.addRuleLabel}>
        {testing ? 'Testing…' : 'Test direct'}
      </Text>
    </PressableScale>
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

// Core Logs (issue #136): raw core lines; tag chips filter, nothing to tap.
const TAG_FILTERS = ['all', ...CORE_LOG_TAGS] as const;
type TagFilter = (typeof TAG_FILTERS)[number];

function CoreRows(props: RowsProps<CoreLogRow>) {
  const { styles, logs } = props;
  const { coreLogLevel } = useLogSettings();
  const [tagFilter, setTagFilter] = useState<TagFilter>('all');
  // The Core Log Level also filters the tab (CONTEXT.md): after lowering the
  // level, rows captured at a noisier level drop out of view but stay buffered.
  const maxRank = CORE_LOG_LEVELS.indexOf(coreLogLevel);
  const shown = useMemo(
    () =>
      logs.filter(
        l =>
          CORE_LOG_LEVELS.indexOf(l.level) <= maxRank &&
          (tagFilter === 'all' || l.tag === tagFilter),
      ),
    [logs, tagFilter, maxRank],
  );
  return (
    <>
      <View style={styles.chipRow}>
        {TAG_FILTERS.map(tag => {
          const active = tag === tagFilter;
          return (
            <PressableScale
              key={tag}
              testID={`logs-core-tag-${tag}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setTagFilter(tag)}
            >
              <Text
                style={[styles.chipLabel, active && styles.chipLabelActive]}
              >
                {tag}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <LogRows
        {...props}
        logs={shown}
        testID="logs-core-list"
        emptyText="No Core Logs yet. Rows collect while the tunnel is running."
        stampOf={log => log.stamp}
        renderBody={log => (
          <>
            <View style={styles.badgeRow}>
              <Text style={styles.tagChip}>[{log.tag}]</Text>
              <Text
                style={[
                  styles.levelBadge,
                  log.level === 'error' && styles.levelError,
                ]}
              >
                {log.level.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.logLine}>{log.message}</Text>
            <Text style={styles.logTime}>{log.stamp.toISOString()}</Text>
          </>
        )}
      />
    </>
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
    addRuleButton: {
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    addRuleLabel: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    probeVerdict: {
      ...typography.caption,
      marginTop: spacing.sm,
      color: colors.textPrimary,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    chip: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    chipActive: {
      backgroundColor: colors.buttonPrimary,
      borderColor: colors.buttonPrimary,
    },
    chipLabel: {
      ...typography.caption,
      color: colors.textPrimary,
    },
    chipLabelActive: {
      color: colors.buttonPrimaryText,
    },
    badgeRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    tagChip: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.textPrimary,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: colors.inputBackground,
    },
    levelBadge: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    levelError: {
      color: colors.danger,
    },
  });
}
