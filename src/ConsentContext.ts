import { createContext } from 'react';
import type { ConsentContextValue } from './types';

/**
 * Internal context. `null` sentinel lets {@link useConsent} throw a
 * descriptive error when used outside a provider.
 */
export const ConsentContext = createContext<ConsentContextValue | null>(null);
