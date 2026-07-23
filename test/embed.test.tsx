import './dialogPolyfill';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CipaProvider, CipaEmbed, privacyEnhanceSrc, useCipaConsent } from '../src/index';
import type { ConsentRecord } from '../src/types';

// AC17 — media embed facade.

function RevokeButton() {
  const { revoke } = useCipaConsent();
  return (
    <button type="button" onClick={() => revoke()}>
      Revoke
    </button>
  );
}

async function acceptDialog() {
  const user = userEvent.setup();
  const acceptButton = await screen.findByRole('button', { name: 'Accept' });
  await user.click(acceptButton);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('CipaEmbed media facade (AC17)', () => {
  it('(a) pre-consent renders no iframe, a placeholder with title and an Accept & load button', async () => {
    render(
      <CipaProvider>
        <CipaEmbed src="https://www.youtube.com/embed/x" title="Demo" />
      </CipaProvider>,
    );

    // Dialog is present (pending state) — wait for hydration to settle.
    await screen.findByRole('dialog');

    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByText('Demo')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Accept & load' })).not.toBeNull();
  });

  it('(b) clicking the placeholder button records an embed-method grant and mounts the iframe; dialog Accept also mounts it', async () => {
    let lastGrant: ConsentRecord | null = null;

    const { unmount } = render(
      <CipaProvider onGrant={(record) => (lastGrant = record)}>
        <CipaEmbed src="https://www.youtube.com/embed/x" title="Demo" />
      </CipaProvider>,
    );

    await screen.findByRole('dialog');
    const loadButton = screen.getByRole('button', { name: 'Accept & load' });
    await userEvent.setup().click(loadButton);

    await waitFor(() => {
      expect(document.querySelector('iframe')).not.toBeNull();
    });
    expect(lastGrant).not.toBeNull();
    expect((lastGrant as unknown as ConsentRecord).method).toBe('embed');

    unmount();
    window.localStorage.clear();

    // Dialog-based Accept mounts the embed too (same consent state).
    render(
      <CipaProvider>
        <CipaEmbed src="https://www.youtube.com/embed/x" title="Demo" />
      </CipaProvider>,
    );
    await acceptDialog();
    await waitFor(() => {
      expect(document.querySelector('iframe')).not.toBeNull();
    });
  });

  it('(c) privacyEnhanceSrc rewrites YouTube and Vimeo, leaves unknown hosts unchanged', () => {
    expect(privacyEnhanceSrc('https://www.youtube.com/embed/x')).toBe(
      'https://www.youtube-nocookie.com/embed/x',
    );
    expect(privacyEnhanceSrc('https://youtube.com/embed/x')).toBe(
      'https://www.youtube-nocookie.com/embed/x',
    );

    const vimeoResult = privacyEnhanceSrc('https://player.vimeo.com/video/123');
    expect(vimeoResult).toContain('dnt=1');
    expect(vimeoResult.startsWith('https://player.vimeo.com/video/123')).toBe(true);

    expect(privacyEnhanceSrc('https://example.com/embed/x')).toBe(
      'https://example.com/embed/x',
    );
  });

  it('(c) CipaEmbed applies privacyEnhanced by default and can be disabled', async () => {
    const { unmount } = render(
      <CipaProvider>
        <CipaEmbed src="https://www.youtube.com/embed/x" title="Demo" />
      </CipaProvider>,
    );
    await acceptDialog();
    await waitFor(() => {
      const iframe = document.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/x');
    });

    unmount();
    window.localStorage.clear();

    render(
      <CipaProvider>
        <CipaEmbed
          src="https://www.youtube.com/embed/x"
          title="Demo"
          privacyEnhanced={false}
        />
      </CipaProvider>,
    );
    await acceptDialog();
    await waitFor(() => {
      const iframe = document.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/x');
    });
  });

  it('(d) revoke unmounts the iframe and shows the placeholder again', async () => {
    render(
      <CipaProvider>
        <CipaEmbed src="https://www.youtube.com/embed/x" title="Demo" />
        <RevokeButton />
      </CipaProvider>,
    );

    await acceptDialog();
    await waitFor(() => {
      expect(document.querySelector('iframe')).not.toBeNull();
    });
    expect(screen.queryByRole('button', { name: 'Accept & load' })).toBeNull();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Revoke' }));

    await waitFor(() => {
      expect(document.querySelector('iframe')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Accept & load' })).not.toBeNull();
  });
});
