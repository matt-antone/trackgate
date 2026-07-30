import type { CategoryDecision, ConsentRecord, ConsentStorage } from './types';

export const DEFAULT_STORAGE_KEY = 'trackgate-consent';

/**
 * Default localStorage-backed storage. Guards `typeof window` (SSR) and wraps
 * every access in try/catch (Safari private mode throws on set).
 */
export const localStorageBackend: ConsentStorage = {
  get(key) {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore write failures (private mode / quota) */
    }
  },
  remove(key) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isValidRecord(value: unknown): value is ConsentRecord {
  if (typeof value !== 'object' || value === null) return false;
  const rec = value as Record<string, unknown>;
  if (typeof rec.policyVersion !== 'string') return false;
  if (typeof rec.timestamp !== 'string') return false;
  if (rec.method !== 'dialog' && rec.method !== 'api' && rec.method !== 'embed') {
    return false;
  }
  if (typeof rec.recordId !== 'string' || rec.recordId.length === 0) return false;
  if (typeof rec.categories !== 'object' || rec.categories === null) return false;
  for (const decision of Object.values(rec.categories as Record<string, unknown>)) {
    if (decision !== 'granted' && decision !== 'denied') return false;
  }
  return true;
}

export function aggregateDecision(record: ConsentRecord): CategoryDecision {
  // Binary v1 UX: all configured categories share one decision. If any category
  // is denied, treat the record as denied (fail closed).
  const decisions = Object.values(record.categories);
  if (decisions.length === 0) return 'denied';
  return decisions.every((d) => d === 'granted') ? 'granted' : 'denied';
}

/**
 * Read and validate a stored record. Returns `null` (→ pending / re-prompt) on
 * ANY shape mismatch, version mismatch, corruption, or TTL expiry. Fails closed.
 *
 * - `ttlDays` expires GRANTED records only.
 * - `declineTtlDays` (when set) expires DENIED records only.
 */
export function readRecord(
  storage: ConsentStorage,
  key: string,
  policyVersion: string,
  ttlDays?: number,
  declineTtlDays?: number,
): ConsentRecord | null {
  let raw: string | null;
  try {
    raw = storage.get(key);
  } catch {
    return null;
  }
  if (raw == null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isValidRecord(parsed)) return null;
  if (parsed.policyVersion !== policyVersion) return null;

  const ts = Date.parse(parsed.timestamp);
  if (Number.isNaN(ts)) return null;
  const ageMs = Date.now() - ts;

  const decision = aggregateDecision(parsed);
  if (decision === 'granted' && ttlDays != null && ageMs > ttlDays * DAY_MS) {
    return null;
  }
  if (
    decision === 'denied' &&
    declineTtlDays != null &&
    ageMs > declineTtlDays * DAY_MS
  ) {
    return null;
  }

  return parsed;
}
