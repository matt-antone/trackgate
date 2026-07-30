import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ConsentProvider, ConsentEmbed } from '../src/index';
import { acceptDialog } from './helpers';

// classNames slot overrides: a slot with a custom class must carry the class
// and drop its default inline style (inline styles beat class rules).

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('ConsentDialog classNames', () => {
  it('applies slot classes and drops default inline styles on classed slots', async () => {
    render(
      <ConsentProvider
        dialogProps={{
          privacyPolicyUrl: 'https://example.com/privacy',
          classNames: { dialog: 'my-dialog', acceptButton: 'my-accept' },
        }}
      >
        <div />
      </ConsentProvider>,
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog.className).toBe('my-dialog');
    expect(dialog.getAttribute('style')).toBeNull();

    const accept = screen.getByRole('button', { name: 'Accept' });
    expect(accept.className).toBe('my-accept');
    expect(accept.getAttribute('style')).toBeNull();

    // Unclassed slots keep their default inline styling.
    const decline = screen.getByRole('button', { name: 'Decline' });
    expect(decline.className).toBe('');
    expect(decline.getAttribute('style')).not.toBeNull();
  });
});

describe('ConsentEmbed classNames', () => {
  it('applies placeholder/button classes pre-consent and iframe class post-consent', async () => {
    render(
      <ConsentProvider>
        <ConsentEmbed
          src="https://www.youtube.com/embed/x"
          title="Demo"
          classNames={{ placeholder: 'my-panel', button: 'my-load', iframe: 'my-frame' }}
        />
      </ConsentProvider>,
    );

    await screen.findByRole('dialog');

    const button = screen.getByRole('button', { name: 'Accept & load' });
    expect(button.className).toBe('my-load');
    expect(button.getAttribute('style')).toBeNull();

    const panel = button.parentElement as HTMLElement;
    expect(panel.className).toBe('my-panel');
    expect(panel.getAttribute('style')).toBeNull();

    await acceptDialog();

    const iframe = await waitFor(() => {
      const el = document.querySelector('iframe');
      expect(el).not.toBeNull();
      return el as HTMLIFrameElement;
    });
    expect(iframe.className).toBe('my-frame');
    expect(iframe.getAttribute('style')).toBeNull();
  });
});
