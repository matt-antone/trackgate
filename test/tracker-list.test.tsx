import './dialogPolyfill';
import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CipaProvider, CipaTracking, useCipaConsent } from '../src/index';
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

describe('declarative tracker list (AC16)', () => {
  it('(a) gates a component tracker and a script tracker; DOM-level idempotent under StrictMode; unmounts/persists on revoke', async () => {
    const trackers: TrackerDefinition[] = [
      { id: 'px', component: MockPixel },
      { id: 'ga', src: 'https://tracker.example/ga.js' },
    ];

    render(
      <StrictMode>
        <CipaProvider trackers={trackers}>
          <RevokeButton />
        </CipaProvider>
      </StrictMode>,
    );

    // Pre-consent: nothing rendered, nothing injected.
    expect(screen.queryByTestId('mock-pixel')).toBeNull();
    expect(document.querySelectorAll('script[data-cipa-id="ga"]')).toHaveLength(0);

    await acceptDialog();

    await waitFor(() => {
      expect(screen.queryByTestId('mock-pixel')).not.toBeNull();
    });
    // Exactly one script tag, even under StrictMode's double-invoked effects.
    expect(document.querySelectorAll('script[data-cipa-id="ga"]')).toHaveLength(1);

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
      <CipaProvider>
        <CipaTracking>
          <div data-testid="jsx-tracked">jsx tracked</div>
        </CipaTracking>
      </CipaProvider>,
    );

    expect(screen.queryByTestId('jsx-tracked')).toBeNull();

    await acceptDialog();

    await waitFor(() => {
      expect(screen.queryByTestId('jsx-tracked')).not.toBeNull();
    });

    const cipaWarnings = warnSpy.mock.calls.filter((call) =>
      call.some((arg) => String(arg).includes('cipa-provider')),
    );
    const cipaErrors = errorSpy.mock.calls.filter((call) =>
      call.some((arg) => String(arg).includes('cipa-provider')),
    );
    expect(cipaWarnings).toHaveLength(0);
    expect(cipaErrors).toHaveLength(0);
  });

  it('(c) duplicate id logs a dev warning; first definition wins; renders once', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const trackers: TrackerDefinition[] = [
      { id: 'dup', component: MockPixelA },
      { id: 'dup', component: MockPixelB },
    ];

    render(
      <CipaProvider trackers={trackers}>
        <div />
      </CipaProvider>,
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
      <CipaProvider trackers={trackers}>
        <RevokeButton />
      </CipaProvider>,
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
      expect(document.querySelectorAll('script[data-cipa-id="ga2"]')).toHaveLength(1);
    });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Revoke' }));

    // Script tag persists post-revoke (documented limitation).
    await waitFor(() => {
      expect(document.querySelectorAll('script[data-cipa-id="ga2"]')).toHaveLength(1);
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
      <CipaProvider trackers={trackers} reloadOnRevoke>
        <RevokeButton />
      </CipaProvider>,
    );

    await acceptDialog();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Revoke' }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('(e) composition: trackers list + JSX <CipaTracking> child gate on the same state', async () => {
    const trackers: TrackerDefinition[] = [{ id: 'px2', component: MockPixel }];

    render(
      <CipaProvider trackers={trackers}>
        <CipaTracking>
          <div data-testid="jsx-tracked">jsx tracked</div>
        </CipaTracking>
      </CipaProvider>,
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
