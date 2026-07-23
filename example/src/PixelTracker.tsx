import { useEffect, useRef } from 'react';

/**
 * Fake tracking pixel. Only mounts inside <ConsentGate> once consent is
 * granted, so this effect only ever runs post-consent. The `firedRef` guard
 * is the StrictMode-safe idempotency pattern from the README ("Beacon
 * idempotency: your tracker's job, not the provider's") — StrictMode
 * double-invokes effects in dev (mount -> cleanup -> mount), so without the
 * guard this would fire the beacon twice.
 */
export function PixelTracker() {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    console.log('[PixelTracker] firing demo beacon (visible in Network tab)');
    fetch('https://httpbin.org/get?tracker=demo-pixel').catch((err) => {
      console.warn('[PixelTracker] beacon request failed (offline?)', err);
    });
  }, []);

  return <p>[pixel tracker mounted — beacon sent, see Network tab]</p>;
}
