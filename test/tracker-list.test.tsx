import './dialogPolyfill';
import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentProvider, ConsentGate, useConsent } from '../src/index';
import type { TrackerDefinition } from '../src/types';

// AC16 — declarative tracker list.

function MockPixel() {
  return <div data-testid="mock-pixel">pixel</div>;
}

function MockPixelA() {
  return <div data-testid="mock-pixel-a">pixel-a</div>;
}

function MockPixelB() {
  return <div data-testid="mock-pixel-b">pixel-b</div>;
}

/** Test-only harness exposing revoke() via a button, since revoke isn't a JSX prop. */
function RevokeButton() {
  const { revoke } = useConsent();
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

describe('declarative tracker list (AC16)', () => {
  it('(a) gates a component tracker and a script tracker; DOM-level idempotent under StrictMode; unmounts/persists on revoke', async () => {
    const trackers: TrackerDefinition[] = [
      { id: 'px', component: MockPixel },
      { id: 'ga', src: 'https://tracker.example/ga.js' },
    ];

    render(
      <StrictMode>
        <ConsentProvider trackers={trackers}>
          <RevokeButton />
        </ConsentProvider>
      </StrictMode>,
    );

    // Pre-consent: nothing rendered, nothing injected.
    expect(screen.queryByTestId('mock-pixel')).toBeNull();
    expect(document.querySelectorAll('script[data-trackgate-id="ga"]')).toHaveLength(0);

    await acceptDialog();

    await waitFor(() => {
      expect(screen.queryByTestId('mock-pixel')).not.toBeNull();
    });
    // Exactly one script tag, even under StrictMode's double-invoked effects.
    expect(document.querySelectorAll('script[data-trackgate-id="ga"]')).toHaveLength(1);

    const revokeButton = screen.getByRole('button', { name: 'Revoke' });
    await userEvent.setup().click(revokeButton);

    await waitFor(() => {
      expect(screen.queryByTestId('mock-pixel')).toBeNull();
    });
  });

  it('(b) omitting the trackers prop behaves identically to JSX-only gating, no errors/warnings', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ConsentProvider>
        <ConsentGate>
          <div data-testid="jsx-tracked">jsx tracked</div>
        </ConsentGate>
      </ConsentProvider>,
    );

    expect(screen.queryByTestId('jsx-tracked')).toBeNull();

    await acceptDialog();

    await waitFor(() => {
      expect(screen.queryByTestId('jsx-tracked')).not.toBeNull();
    });

    const trackgateWarnings = warnSpy.mock.calls.filter((call) =>
      call.some((arg) => String(arg).includes('trackgate')),
    );
    const trackgateErrors = errorSpy.mock.calls.filter((call) =>
      call.some((arg) => String(arg).includes('trackgate')),
    );
    expect(trackgateWarnings).toHaveLength(0);
    expect(trackgateErrors).toHaveLength(0);
  });

  it('(c) duplicate id logs a dev warning; first definition wins; renders once', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const trackers: TrackerDefinition[] = [
      { id: 'dup', component: MockPixelA },
      { id: 'dup', component: MockPixelB },
    ];

    render(
      <ConsentProvider trackers={trackers}>
        <div />
      </ConsentProvider>,
    );

    await acceptDialog();

    await waitFor(() => {
      expect(screen.queryByTestId('mock-pixel-a')).not.toBeNull();
    });
    expect(screen.queryByTestId('mock-pixel-b')).toBeNull();
    expect(screen.getAllByTestId('mock-pixel-a')).toHaveLength(1);

    const dupWarning = warnSpy.mock.calls.find((call) =>
      call.some((arg) => String(arg).includes('Duplicate tracker id')),
    );
    expect(dupWarning).toBeTruthy();
  });

  it('(d) without reloadOnRevoke: ga script persists after revoke + mount-time dev warning; with reloadOnRevoke: revoke reloads', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const trackers: TrackerDefinition[] = [{ id: 'ga2', src: 'https://tracker.example/ga2.js' }];

    const { unmount } = render(
      <ConsentProvider trackers={trackers}>
        <RevokeButton />
      </ConsentProvider>,
    );

    // Mount-time warning: a src entry exists and reloadOnRevoke is unset.
    await waitFor(() => {
      const mountWarning = warnSpy.mock.calls.find((call) =>
        call.some((arg) => String(arg).includes('reloadOnRevoke')),
      );
      expect(mountWarning).toBeTruthy();
    });

    await acceptDialog();
    await waitFor(() => {
      expect(document.querySelectorAll('script[data-trackgate-id="ga2"]')).toHaveLength(1);
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Revoke' }));

    // Script tag persists post-revoke (documented limitation).
    await waitFor(() => {
      expect(document.querySelectorAll('script[data-trackgate-id="ga2"]')).toHaveLength(1);
    });

    unmount();
    window.localStorage.clear();

    // Now with reloadOnRevoke: true, revoke should trigger location.reload().
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
      configurable: true,
    });

    render(
      <ConsentProvider trackers={trackers} reloadOnRevoke>
        <RevokeButton />
      </ConsentProvider>,
    );

    await acceptDialog();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Revoke' }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('(e) composition: trackers list + JSX <ConsentGate> child gate on the same state', async () => {
    const trackers: TrackerDefinition[] = [{ id: 'px2', component: MockPixel }];

    render(
      <ConsentProvider trackers={trackers}>
        <ConsentGate>
          <div data-testid="jsx-tracked">jsx tracked</div>
        </ConsentGate>
      </ConsentProvider>,
    );

    expect(screen.queryByTestId('mock-pixel')).toBeNull();
    expect(screen.queryByTestId('jsx-tracked')).toBeNull();

    await acceptDialog();

    await waitFor(() => {
      expect(screen.queryByTestId('mock-pixel')).not.toBeNull();
    });
    expect(screen.queryByTestId('jsx-tracked')).not.toBeNull();
  });
});
