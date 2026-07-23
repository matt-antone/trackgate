import type { CSSProperties, ReactNode } from 'react';
import { ConsentGate } from './ConsentGate';
import { useConsent } from './useConsent';

export interface ConsentEmbedPlaceholderApi {
  grant: () => void;
  title: string;
}

export interface ConsentEmbedProps {
  src: string;
  title: string;
  category?: string;
  placeholder?: (api: ConsentEmbedPlaceholderApi) => ReactNode;
  thumbnailUrl?: string;
  width?: number | string;
  height?: number | string;
  allow?: string;
  /** Rewrite known vendors to privacy-reduced URLs. Default true. */
  privacyEnhanced?: boolean;
}

/**
 * Rewrite known embed vendors to privacy-reduced URLs:
 * - youtube.com/embed → youtube-nocookie.com/embed
 * - player.vimeo.com → append dnt=1
 * Unknown hosts pass through untouched.
 */
export function privacyEnhanceSrc(src: string): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }
  if (
    (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') &&
    url.pathname.startsWith('/embed')
  ) {
    url.hostname = 'www.youtube-nocookie.com';
    return url.toString();
  }
  if (url.hostname === 'player.vimeo.com') {
    url.searchParams.set('dnt', '1');
    return url.toString();
  }
  return src;
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  boxSizing: 'border-box',
  padding: '1rem',
  textAlign: 'center',
  background: 'var(--trackgate-embed-bg, #f2f2f2)',
  color: 'var(--trackgate-embed-color, #111)',
  border: 'var(--trackgate-embed-border, 1px solid rgba(0,0,0,0.15))',
  borderRadius: 'var(--trackgate-embed-radius, 8px)',
};

const buttonStyle: CSSProperties = {
  padding: '0.5rem 1rem',
  fontSize: '1rem',
  fontWeight: 500,
  border: '1px solid currentColor',
  borderRadius: '6px',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
};

/**
 * Consent facade for third-party iframe embeds (YouTube/Vimeo/etc.). Pre-consent
 * renders a same-size placeholder with a click-to-load button (records a grant
 * with `method:'embed'`); post-consent renders the iframe. Pure composition over
 * {@link ConsentGate} — no new gating path.
 */
export function ConsentEmbed({
  src,
  title,
  category = 'default',
  placeholder,
  thumbnailUrl,
  width = 560,
  height = 315,
  allow,
  privacyEnhanced = true,
}: ConsentEmbedProps) {
  const { statusFor, grant } = useConsent();
  const granted = statusFor(category) === 'granted';
  const loadEmbed = () => grant('embed');

  const finalSrc = privacyEnhanced ? privacyEnhanceSrc(src) : src;

  return (
    <>
      {!granted &&
        (placeholder ? (
          placeholder({ grant: loadEmbed, title })
        ) : (
          <div style={{ ...panelStyle, width, height }}>
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt=""
                style={{ maxWidth: '100%', maxHeight: '50%', objectFit: 'contain' }}
              />
            ) : null}
            <span>{title}</span>
            <button type="button" style={buttonStyle} onClick={loadEmbed}>
              Accept &amp; load
            </button>
          </div>
        ))}
      <ConsentGate category={category}>
        <iframe
          src={finalSrc}
          title={title}
          width={width}
          height={height}
          allow={allow}
          style={{ border: 0 }}
        />
      </ConsentGate>
    </>
  );
}
