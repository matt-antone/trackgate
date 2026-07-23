import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConsentContext } from './ConsentContext';
import { ConsentDialog } from './ConsentDialog';
import { ConsentTrackerList } from './trackers';
import {
  DEFAULT_STORAGE_KEY,
  aggregateDecision,
  localStorageBackend,
  readRecord,
} from './storage';
import type {
  CategoryDecision,
  ConsentContextValue,
  ConsentProviderProps,
  ConsentMethod,
  ConsentRecord,
  ConsentStatus,
} from './types';

export function ConsentProvider({
  policyVersion = '1',
  ttlDays,
  declineTtlDays,
  categories = ['default'],
  reloadOnRevoke = false,
  trackers,
  storage = localStorageBackend,
  storageKey = DEFAULT_STORAGE_KEY,
  onGrant,
  onDeny,
  onRevoke,
  dialog,
  dialogProps,
  children,
}: ConsentProviderProps) {
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const status: ConsentStatus =
    !hydrated || record === null ? 'pending' : aggregateDecision(record);

  // Keep a ref of the live status so cross-tab handlers can detect transitions
  // (granted → denied = a revoke) without stale closures.
  const statusRef = useRef(status);
  statusRef.current = status;

  const buildRecord = useCallback(
    (decision: CategoryDecision, method: ConsentMethod): ConsentRecord => {
      const cats: Record<string, CategoryDecision> = {};
      for (const c of categories) cats[c] = decision;
      return {
        categories: cats,
        policyVersion,
        timestamp: new Date().toISOString(),
        method,
      };
    },
    [categories, policyVersion],
  );

  const persist = useCallback(
    (next: ConsentRecord) => {
      storage.set(storageKey, JSON.stringify(next));
      setRecord(next);
    },
    [storage, storageKey],
  );

  const grant = useCallback(
    (method: ConsentMethod = 'api') => {
      const next = buildRecord('granted', method);
      persist(next);
      onGrant?.(next);
    },
    [buildRecord, persist, onGrant],
  );

  const deny = useCallback(
    (method: ConsentMethod = 'api') => {
      const next = buildRecord('denied', method);
      persist(next);
      onDeny?.(next);
    },
    [buildRecord, persist, onDeny],
  );

  const revoke = useCallback(() => {
    const next = buildRecord('denied', 'api');
    persist(next);
    onRevoke?.(next);
    if (reloadOnRevoke && typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [buildRecord, persist, onRevoke, reloadOnRevoke]);

  const reset = useCallback(() => {
    storage.remove(storageKey);
    setRecord(null);
  }, [storage, storageKey]);

  const statusFor = useCallback(
    (category: string): ConsentStatus => {
      if (!hydrated || record === null) return 'pending';
      return record.categories[category] === 'granted' ? 'granted' : 'denied';
    },
    [hydrated, record],
  );

  // Hydrate from storage after mount (SSR-safe: server + first client render are
  // identical 'pending'/hydrated=false). Also subscribe to cross-tab updates.
  useEffect(() => {
    setRecord(readRecord(storage, storageKey, policyVersion, ttlDays, declineTtlDays));
    setHydrated(true);

    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      const wasGranted = statusRef.current === 'granted';
      const next = readRecord(
        storage,
        storageKey,
        policyVersion,
        ttlDays,
        declineTtlDays,
      );
      setRecord(next);
      const nowGranted = next !== null && aggregateDecision(next) === 'granted';
      if (reloadOnRevoke && wasGranted && !nowGranted) {
        window.location.reload();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storage, storageKey, policyVersion, ttlDays, declineTtlDays, reloadOnRevoke]);

  const value: ConsentContextValue = useMemo(
    () => ({
      status,
      statusFor,
      hydrated,
      record,
      categories,
      grant,
      deny,
      revoke,
      reset,
    }),
    [status, statusFor, hydrated, record, categories, grant, deny, revoke, reset],
  );

  const showDialog = hydrated && status === 'pending';

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {trackers && trackers.length > 0 ? (
        <ConsentTrackerList trackers={trackers} reloadOnRevoke={reloadOnRevoke} />
      ) : null}
      {showDialog
        ? dialog
          ? dialog({
              status,
              grant: () => grant('dialog'),
              deny: () => deny('dialog'),
            })
          : (
            <ConsentDialog
              {...dialogProps}
              onAccept={() => grant('dialog')}
              onDecline={() => deny('dialog')}
            />
          )
        : null}
    </ConsentContext.Provider>
  );
}
