import type { ReactNode } from 'react';
import { useCipaConsent } from './useCipaConsent';
import { isDev } from './env';

export interface CipaTrackingProps {
  /** Consent category to gate on. Defaults to 'default'. */
  category?: string;
  children?: ReactNode;
}

/**
 * The gate. Renders children only when consent for `category` is granted;
 * otherwise renders nothing (children never mount → no scripts, no requests).
 * Trackers unmount automatically on revoke.
 *
 * If `category` is not one the provider was configured with, fails closed
 * (never mounts) and warns in dev — a silent DX trap otherwise.
 */
export function CipaTracking({
  category = 'default',
  children,
}: CipaTrackingProps) {
  const { statusFor, categories } = useCipaConsent();

  if (isDev && !categories.includes(category)) {
    console.warn(
      `[cipa-provider] <CipaTracking category="${category}"> references a category not ` +
        `configured on <CipaProvider categories={${JSON.stringify(categories)}}>. ` +
        'It will never render (failing closed). Add the category to the provider.',
    );
  }

  return statusFor(category) === 'granted' ? <>{children}</> : null;
}
