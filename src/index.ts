export { CipaProvider } from './CipaProvider';
export { CipaTracking } from './CipaTracking';
export { CipaEmbed, privacyEnhanceSrc } from './CipaEmbed';
export { ConsentDialog } from './ConsentDialog';
export {
  GtagConsentBridge,
  CONSENT_MODE_DEFAULT_SNIPPET,
} from './gtagConsentBridge';
export { useCipaConsent } from './useCipaConsent';
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
  CipaProviderProps,
  CipaContextValue,
} from './types';
export type { CipaTrackingProps } from './CipaTracking';
export type { CipaEmbedProps, CipaEmbedPlaceholderApi } from './CipaEmbed';
