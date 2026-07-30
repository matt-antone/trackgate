import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentProvider, ConsentEmbed, privacyEnhanceSrc } from '../src/index';
import type { ConsentRecord } from '../src/types';
import { RevokeButton, acceptDialog } from './helpers';

// AC17 — media embed facade.

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('ConsentEmbed media facade (AC17)', () => {
  it('(a) pre-consent renders no iframe, a placeholder with title and an Accept & load button', async () => {
    render(
      <ConsentProvider>
        <ConsentEmbed src="https://www.youtube.com/embed/x" title="Demo" />
      </ConsentProvider>,
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
      <ConsentProvider onGrant={(record) => (lastGrant = record)}>
        <ConsentEmbed src="https://www.youtube.com/embed/x" title="Demo" />
      </ConsentProvider>,
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
      <ConsentProvider>
        <ConsentEmbed src="https://www.youtube.com/embed/x" title="Demo" />
      </ConsentProvider>,
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

  it('(c) ConsentEmbed applies privacyEnhanced by default and can be disabled', async () => {
    const { unmount } = render(
      <ConsentProvider>
        <ConsentEmbed src="https://www.youtube.com/embed/x" title="Demo" />
      </ConsentProvider>,
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
      <ConsentProvider>
        <ConsentEmbed
          src="https://www.youtube.com/embed/x"
          title="Demo"
          privacyEnhanced={false}
        />
      </ConsentProvider>,
    );
    await acceptDialog();
    await waitFor(() => {
      const iframe = document.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/x');
    });
  });

  it('(e) post-consent iframe has credentialless by default; credentialless={false} removes it', async () => {
    const { unmount } = render(
      <ConsentProvider>
        <ConsentEmbed src="https://www.youtube.com/embed/x" title="Demo" />
      </ConsentProvider>,
    );
    await acceptDialog();
    await waitFor(() => {
      const iframe = document.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe?.hasAttribute('credentialless')).toBe(true);
    });

    unmount();
    window.localStorage.clear();

    render(
      <ConsentProvider>
        <ConsentEmbed src="https://www.youtube.com/embed/x" title="Demo" credentialless={false} />
      </ConsentProvider>,
    );
    await acceptDialog();
    await waitFor(() => {
      const iframe = document.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe?.hasAttribute('credentialless')).toBe(false);
    });
  });

  it('(f) post-consent iframe has the default referrerpolicy attribute', async () => {
    render(
      <ConsentProvider>
        <ConsentEmbed src="https://www.youtube.com/embed/x" title="Demo" />
      </ConsentProvider>,
    );
    await acceptDialog();
    await waitFor(() => {
      const iframe = document.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe?.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    });
  });

  it('(g) warns in dev when thumbnailUrl points at a known vendor host, not for self-hosted thumbnails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { unmount } = render(
      <ConsentProvider>
        <ConsentEmbed
          src="https://www.youtube.com/embed/x"
          title="Demo"
          thumbnailUrl="https://i.ytimg.com/vi/x/hq.jpg"
        />
      </ConsentProvider>,
    );
    await screen.findByRole('dialog');
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[trackgate]'));
    });

    unmount();
    warnSpy.mockClear();
    window.localStorage.clear();

    render(
      <ConsentProvider>
        <ConsentEmbed
          src="https://www.youtube.com/embed/x"
          title="Demo"
          thumbnailUrl="https://example.com/thumb.jpg"
        />
      </ConsentProvider>,
    );
    await screen.findByRole('dialog');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('(d) revoke unmounts the iframe and shows the placeholder again', async () => {
    render(
      <ConsentProvider>
        <ConsentEmbed src="https://www.youtube.com/embed/x" title="Demo" />
        <RevokeButton />
      </ConsentProvider>,
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
