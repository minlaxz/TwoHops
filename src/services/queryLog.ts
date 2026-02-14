import type { QueryLogAction, ConnectionProtocol, QueryLogRow } from '../types';

const ACTION_KEY = 'action';
const DOMAIN_KEY = 'domain';
const SOURCE_KEY = 'src';
const DESTINATION_KEY = 'dst';
const PROTOCOL_KEY = 'proto';
const TIMESTAMP_KEY = 'date';

const ACTIONS: QueryLogAction[] = ['bypass', 'tunnel', 'reject'];
const PROTOCOLS: ConnectionProtocol[] = ['tcp', 'udp'];

export function parseQueryLogRow(raw: string): QueryLogRow {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse query log entry:', err);
    throw new Error('Query log entry is not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Query log entry must be an object');
  }

  const data = parsed as Record<string, unknown>;

  const action = parseAction(data);
  const protocol = parseProtocol(data);
  const source = parseRequiredString(data, SOURCE_KEY);
  const destination = parseNullableString(data, DESTINATION_KEY);
  const domain = parseNullableString(data, DOMAIN_KEY);
  const stamp = parseTimestamp(data, TIMESTAMP_KEY);

  return {
    action,
    protocol,
    source,
    destination,
    domain,
    stamp,
  };
}

function parseTimestamp(data: Record<string, unknown>, key: string): Date {
  const raw = data[key];
  const parsed = new Date(String(raw));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Cannot parse timestamp from ${String(raw)}`);
  }
  return parsed;
}

function parseNullableString(
  data: Record<string, unknown>,
  key: string,
): string | null {
  const raw = data[key];
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== 'string') {
    throw new Error(`Expected ${key} to be a string or null`);
  }
  return raw;
}

function parseRequiredString(
  data: Record<string, unknown>,
  key: string,
): string {
  const raw = data[key];
  if (raw === undefined || raw === null) {
    throw new Error(`Expected ${key} to be defined`);
  }
  return String(raw).trim();
}

function parseProtocol(data: Record<string, unknown>): ConnectionProtocol {
  const raw = String(data[PROTOCOL_KEY] ?? '')
    .toLowerCase()
    .trim();
  if (!PROTOCOLS.includes(raw as ConnectionProtocol)) {
    throw new Error(`Invalid protocol ${raw}`);
  }
  return raw as ConnectionProtocol;
}

function parseAction(data: Record<string, unknown>): QueryLogAction {
  const raw = String(data[ACTION_KEY] ?? '')
    .toLowerCase()
    .trim();
  if (!ACTIONS.includes(raw as QueryLogAction)) {
    throw new Error(`Invalid action ${raw}`);
  }
  return raw as QueryLogAction;
}
