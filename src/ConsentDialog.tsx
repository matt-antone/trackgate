import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { ConsentDialogProps } from './types';

interface DefaultConsentDialogProps extends ConsentDialogProps {
  onAccept: () => void;
  onDecline: () => void;
}

// Shared button styling: Accept and Decline are visually identical (equal
// prominence) — an anti-dark-pattern requirement for valid consent.
const buttonStyle: CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  padding: 'var(--trackgate-button-padding, 0.625rem 1rem)',
  fontSize: 'var(--trackgate-button-font-size, 1rem)',
  fontWeight: 500,
  lineHeight: 1.2,
  border: 'var(--trackgate-button-border, 1px solid currentColor)',
  borderRadius: 'var(--trackgate-button-radius, 6px)',
  background: 'var(--trackgate-button-bg, transparent)',
  color: 'var(--trackgate-button-color, inherit)',
  cursor: 'pointer',
};

const dialogStyle: CSSProperties = {
  maxWidth: 'var(--trackgate-dialog-max-width, 28rem)',
  width: 'calc(100% - 2rem)',
  padding: 'var(--trackgate-dialog-padding, 1.5rem)',
  border: 'var(--trackgate-dialog-border, 1px solid rgba(0,0,0,0.15))',
  borderRadius: 'var(--trackgate-dialog-radius, 10px)',
  background: 'var(--trackgate-dialog-bg, #fff)',
  color: 'var(--trackgate-dialog-color, #111)',
  fontFamily: 'var(--trackgate-font-family, system-ui, sans-serif)',
};

/**
 * Default consent dialog on the native `<dialog>` element + `showModal()`:
 * free focus containment, top-layer stacking, and backdrop. Rendered through a
 * portal to `document.body`.
 *
 * Esc handling: we `preventDefault()` the `cancel` event so Esc does NOT close
 * the dialog and NO decision is recorded by dismissal. Consent must be an
 * affirmative Accept/Decline click; dismissal can never imply acceptance.
 */
export function ConsentDialog({
  title = 'We use tracking technologies',
  description = 'With your consent, we load analytics and other tracking tools. Nothing tracks you until you agree. You can decline and still use the site.',
  acceptLabel = 'Accept',
  declineLabel = 'Decline',
  privacyPolicyUrl,
  onAccept,
  onDecline,
}: DefaultConsentDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      style={dialogStyle}
      onCancel={(e) => e.preventDefault()}
    >
      <h2 id={titleId} style={{ margin: '0 0 0.75rem', fontSize: '1.25rem' }}>
        {title}
      </h2>
      <p style={{ margin: '0 0 1.25rem', lineHeight: 1.5 }}>{description}</p>
      {privacyPolicyUrl ? (
        <p style={{ margin: '0 0 1.25rem' }}>
          <a href={privacyPolicyUrl} target="_blank" rel="noreferrer">
            Privacy policy
          </a>
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="button" style={buttonStyle} onClick={onDecline}>
          {declineLabel}
        </button>
        <button type="button" style={buttonStyle} onClick={onAccept}>
          {acceptLabel}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
