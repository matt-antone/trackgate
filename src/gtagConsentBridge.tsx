import { useEffect, useRef } from 'react';
import { useConsent } from './useConsent';
import type { ConsentStatus } from './types';

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | null {
  if (typeof window === 'undefined') return null;
  const g = (window as unknown as { gtag?: unknown }).gtag;
  return typeof g === 'function' ? (g as GtagFn) : null;
}

const DENIED = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
} as const;

const GRANTED = {
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
} as const;

/**
 * Authoritative default-denied Consent Mode v2 snippet. Operators MUST paste
 * this into `<head>` BEFORE any `gtag('config', …)` so a head-loaded GTM/gtag
 * snippet starts denied. The React-mounted bridge cannot retroactively gate a
 * head snippet's initial page_view — this string is the head-side complement.
 */
export const CONSENT_MODE_DEFAULT_SNIPPET = `<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    'analytics_storage': 'denied',
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied'
  });
</script>`;

/**
 * Google Consent Mode v2 bridge. Place INSIDE the provider (not inside the
 * gate). On mount, if consent isn't already granted, fires
 * `gtag('consent','default', …all denied…)`. On status change fires
 * `gtag('consent','update', …)` mapping granted/denied. No-ops when `gtag` is
 * absent.
 */
export function GtagConsentBridge() {
  const { status } = useConsent();
  const prev = useRef<ConsentStatus | null>(null);

  useEffect(() => {
    if (status === 'granted') return;
    const gtag = getGtag();
    if (gtag) gtag('consent', 'default', { ...DENIED });
    // Run once on mount to establish the denied baseline before any in-tree
    // gtag('config', …) (which only mounts post-grant).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prev.current === status) return;
    prev.current = status;
    const gtag = getGtag();
    if (!gtag) return;
    if (status === 'granted') {
      gtag('consent', 'update', { ...GRANTED });
    } else if (status === 'denied') {
      gtag('consent', 'update', { ...DENIED });
    }
    // pending: no update
  }, [status]);

  return null;
}
