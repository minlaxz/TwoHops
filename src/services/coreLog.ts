/** Core Logs (issue #136): raw native core log lines, tagged by component. */

export const CORE_LOG_LEVELS = [
  'error',
  'warn',
  'info',
  'debug',
  'trace',
] as const;
export type CoreLogLevel = (typeof CORE_LOG_LEVELS)[number];

export const CORE_LOG_TAGS = ['dns', 'core', 'client', 'jni', 'other'] as const;
export type CoreLogTag = (typeof CORE_LOG_TAGS)[number];

export type CoreLogRow = {
  level: CoreLogLevel;
  tag: CoreLogTag;
  /** The line after the logger name, unchanged. */
  message: string;
  stamp: Date;
};

// Logger names the core writes as the first token of every line
// (native_libs_common/common/logger.cpp:54: `<LoggerName> <message>`).
const TAG_BY_LOGGER: Record<string, CoreLogTag> = {
  DNS_HANDLER: 'dns',
  DNS_CLIENT: 'dns',
  VPNCORE: 'core',
  VPNCLIENT: 'client',
  'JNI.NativeLogger': 'jni',
  TrustTunnel_Native: 'jni',
};

/** Parses the bridge's `vpn_core_log` payload. Throws on malformed input. */
export function parseCoreLogRow(raw: string): CoreLogRow {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Core log entry is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Core log entry must be an object');
  }
  const data = parsed as Record<string, unknown>;
  const level = String(data.level ?? '').toLowerCase();
  if (!CORE_LOG_LEVELS.includes(level as CoreLogLevel)) {
    throw new Error(`Invalid core log level ${level}`);
  }
  if (typeof data.message !== 'string') {
    throw new Error('Expected message to be a string');
  }
  const stamp = new Date(String(data.date));
  if (Number.isNaN(stamp.getTime())) {
    throw new Error(`Cannot parse timestamp from ${String(data.date)}`);
  }
  const line = data.message.trimStart();
  const split = line.indexOf(' ');
  const name = split === -1 ? line : line.slice(0, split);
  const tag = TAG_BY_LOGGER[name];
  return {
    level: level as CoreLogLevel,
    tag: tag ?? 'other',
    // Unknown logger names keep the whole line: the name may be the message.
    message: tag === undefined ? line : line.slice(split + 1).trimStart(),
    stamp,
  };
}
