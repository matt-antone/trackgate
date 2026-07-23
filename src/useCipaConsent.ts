import { useContext } from 'react';
import { CipaContext } from './CipaContext';
import type { CipaContextValue } from './types';

export function useCipaConsent(): CipaContextValue {
  const ctx = useContext(CipaContext);
  if (ctx === null) {
    throw new Error(
      'useCipaConsent must be used within a <CipaProvider>. ' +
        'Wrap your app (or the tracking subtree) in <CipaProvider> before calling this hook.',
    );
  }
  return ctx;
}
