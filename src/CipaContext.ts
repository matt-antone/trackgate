import { createContext } from 'react';
import type { CipaContextValue } from './types';

/**
 * Internal context. `null` sentinel lets {@link useCipaConsent} throw a
 * descriptive error when used outside a provider.
 */
export const CipaContext = createContext<CipaContextValue | null>(null);
