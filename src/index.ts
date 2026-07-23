export { ConsentProvider } from './ConsentProvider';
export { ConsentGate } from './ConsentGate';
export { ConsentEmbed, privacyEnhanceSrc } from './ConsentEmbed';
export { ConsentDialog } from './ConsentDialog';
export {
  GtagConsentBridge,
  CONSENT_MODE_DEFAULT_SNIPPET,
} from './gtagConsentBridge';
export { useConsent } from './useConsent';
export { loadConsentedScript } from './loadScript';
export { localStorageBackend, DEFAULT_STORAGE_KEY } from './storage';

export type {
  ConsentStatus,
  ConsentMethod,
  CategoryDecision,
  ConsentRecord,
  ConsentStorage,
  TrackerDefinition,
  DialogRenderApi,
  ConsentDialogProps,
  ConsentProviderProps,
  ConsentContextValue,
} from './types';
export type { ConsentGateProps } from './ConsentGate';
export type { ConsentEmbedProps, ConsentEmbedPlaceholderApi } from './ConsentEmbed';
