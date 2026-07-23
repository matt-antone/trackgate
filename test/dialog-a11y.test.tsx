import { act } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { ConsentProvider } from '../src';
import { useConsent } from '../src/useConsent';
import { DEFAULT_STORAGE_KEY } from '../src/storage';

// Note: vitest-axe@0.1.0 mis-declares `toHaveNoViolations` as a type-only
// export (and its `extend-expect` entry point ships an empty file), so the
// custom matcher can't be registered in a type-safe way. Assert on the raw
// axe results (`violations` array) directly instead.

// jsdom does not implement HTMLDialogElement.showModal()/close() (they are
// simply absent from the prototype). Polyfill the minimal behavior the
// component relies on: showModal() opens the dialog, close() closes it.
// `open` itself IS implemented by jsdom (reflected content attribute), so we
// can delegate to it.
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.open = false;
    };
  }
});

function StatusProbe() {
  const { status } = useConsent();
  return <div data-testid="status">{status}</div>;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('Default consent dialog accessibility (AC9)', () => {
  it('renders a native <dialog> shown via showModal()', async () => {
    render(
      <ConsentProvider>
        <StatusProbe />
      </ConsentProvider>,
    );

    const dialog = await waitFor(() => {
      const el = document.querySelector('dialog');
      expect(el).not.toBeNull();
      return el as HTMLDialogElement;
    });

    expect(dialog.open).toBe(true);
  });

  it('has a labelled title via aria-labelledby', async () => {
    render(
      <ConsentProvider>
        <StatusProbe />
      </ConsentProvider>,
    );

    const dialog = await waitFor(() => {
      const el = document.querySelector('dialog');
      expect(el).not.toBeNull();
      return el as HTMLDialogElement;
    });

    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleEl = document.getElementById(labelledBy as string);
    expect(titleEl).not.toBeNull();
    expect(titleEl?.tagName).toBe('H2');
    expect(titleEl?.textContent).toBe('We use tracking technologies');
  });

  it('renders Accept and Decline, both keyboard-reachable, with equal prominence', async () => {
    render(
      <ConsentProvider>
        <StatusProbe />
      </ConsentProvider>,
    );

    await waitFor(() => expect(document.querySelector('dialog')).not.toBeNull());

    const accept = screen.getByRole('button', { name: 'Accept' });
    const decline = screen.getByRole('button', { name: 'Decline' });

    // Keyboard-reachable: real <button> elements, not disabled, not removed
    // from the tab order.
    for (const btn of [accept, decline]) {
      expect(btn.tagName).toBe('BUTTON');
      expect((btn as HTMLButtonElement).disabled).toBe(false);
      expect(btn.tabIndex).not.toBe(-1);
    }

    // Equal prominence: same tag and identical style (no className distinguishes
    // one as "primary" — an anti-dark-pattern requirement for valid consent).
    expect(accept.tagName).toBe(decline.tagName);
    expect(accept.className).toBe(decline.className);
    expect(accept.getAttribute('style')).toBe(decline.getAttribute('style'));
  });

  it('Esc (cancel event) does NOT record a decision: status stays pending, nothing persisted', async () => {
    render(
      <ConsentProvider>
        <StatusProbe />
      </ConsentProvider>,
    );

    const dialog = await waitFor(() => {
      const el = document.querySelector('dialog');
      expect(el).not.toBeNull();
      return el as HTMLDialogElement;
    });

    expect(screen.getByTestId('status').textContent).toBe('pending');
    expect(window.localStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();

    // Simulate the browser firing `cancel` on Escape while a modal <dialog> is open.
    const cancelEvent = new Event('cancel', { cancelable: true, bubbles: false });
    act(() => {
      dialog.dispatchEvent(cancelEvent);
    });

    // The component preventDefault()s the cancel event so it never closes.
    expect(cancelEvent.defaultPrevented).toBe(true);

    // No decision was recorded: status remains pending, storage untouched, and
    // the dialog is still shown (it was never dismissed as an accept/decline).
    expect(screen.getByTestId('status').textContent).toBe('pending');
    expect(window.localStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();
    expect(document.querySelector('dialog')).not.toBeNull();
  });

  it('has no axe violations', async () => {
    render(
      <ConsentProvider>
        <StatusProbe />
      </ConsentProvider>,
    );

    const dialog = await waitFor(() => {
      const el = document.querySelector('dialog');
      expect(el).not.toBeNull();
      return el as HTMLDialogElement;
    });

    // Pass the live, already-mounted node (not an HTML string): axe's `mount`
    // helper swaps `document.body.innerHTML` for detached/string input, which
    // desyncs React's fiber tree from the real DOM and breaks unmount on
    // cleanup. The dialog is portalled into `document.body`, so axe uses it
    // in place with no destructive swap. Disable the page-level "region"
    // (landmark) rule — it fires because this isolated dialog fragment isn't
    // wrapped in a full page's landmark regions, a false positive unrelated
    // to the dialog's own markup/labelling.
    const results = await axe(dialog, { rules: { region: { enabled: false } } });
    expect(results.violations).toHaveLength(0);
  });
});
