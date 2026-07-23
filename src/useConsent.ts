import { useContext } from 'react';
import { ConsentContext } from './ConsentContext';
import type { ConsentContextValue } from './types';

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (ctx === null) {
    throw new Error(
      'useConsent must be used within a <ConsentProvider>. ' +
        'Wrap your app (or the tracking subtree) in <ConsentProvider> before calling this hook.',
    );
  }
  return ctx;
}
