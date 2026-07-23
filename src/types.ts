import type { ComponentType, ReactNode } from 'react';

/**
 * Aggregate consent status. `pending` means no decision recorded yet
 * (fail-closed default: nothing tracks).
 */
export type ConsentStatus = 'pending' | 'granted' | 'denied';

/** How a decision was captured. */
export type ConsentMethod = 'dialog' | 'api' | 'embed';

/** A per-category decision is always a concrete grant/deny (never pending). */
export type CategoryDecision = Exclude<ConsentStatus, 'pending'>;

/**
 * Persisted consent record. Category-keyed from day one so per-category
 * consent later is not a breaking schema change (v1 UX stays binary).
 */
export interface ConsentRecord {
  categories: Record<string, CategoryDecision>;
  policyVersion: string;
  /** ISO 8601 timestamp of the decision. */
  timestamp: string;
  method: ConsentMethod;
}

/** Pluggable persistence backend. Default is localStorage-backed. */
export interface ConsentStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * A declarative tracker: either a React component to mount, or a script URL
 * to inject — always through the consent gate for its category.
 */
export type TrackerDefinition = {
  id: string;
  /** Consent category this tracker belongs to. Defaults to 'default'. */
  category?: string;
} & (
  | { component: ComponentType }
  | { src: string; attrs?: Record<string, string> }
);

/** API handed to a headless dialog render-prop. */
export interface DialogRenderApi {
  status: ConsentStatus;
  grant: () => void;
  deny: () => void;
}

/** Props for the default {@link ConsentDialog}. */
export interface ConsentDialogProps {
  title?: string;
  description?: string;
  acceptLabel?: string;
  declineLabel?: string;
  privacyPolicyUrl?: string;
}

export interface ConsentProviderProps {
  /** Bumping this invalidates stored records → re-prompt. */
  policyVersion?: string;
  /** Expire GRANTED records after N days (denied records unaffected). */
  ttlDays?: number;
  /** Opt-in: expire DENIED records after N days. Off by default (no nagging). */
  declineTtlDays?: number;
  /** Consent categories. Defaults to ['default']. */
  categories?: string[];
  /** Hard-reload after revoke so already-loaded vendor JS dies. Default false. */
  reloadOnRevoke?: boolean;
  /** Declarative tracker list, gated + injected on grant. Optional. */
  trackers?: TrackerDefinition[];
  storage?: ConsentStorage;
  storageKey?: string;
  onGrant?: (record: ConsentRecord) => void;
  onDeny?: (record: ConsentRecord) => void;
  onRevoke?: (record: ConsentRecord) => void;
  /** Headless dialog render-prop; fully replaces the default dialog. */
  dialog?: (api: DialogRenderApi) => ReactNode;
  /** Props forwarded to the default dialog. */
  dialogProps?: ConsentDialogProps;
  children?: ReactNode;
}

/** Value exposed by {@link useConsent}. */
export interface ConsentContextValue {
  status: ConsentStatus;
  statusFor: (category: string) => ConsentStatus;
  hydrated: boolean;
  record: ConsentRecord | null;
  /** Categories configured on the provider (for fail-closed gate checks). */
  categories: readonly string[];
  grant: (method?: ConsentMethod) => void;
  deny: (method?: ConsentMethod) => void;
  revoke: () => void;
  reset: () => void;
}
