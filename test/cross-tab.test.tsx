import './dialogPolyfill';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { CipaProvider, CipaTracking, DEFAULT_STORAGE_KEY } from '../src/index';
import type { ConsentRecord } from '../src/types';

// AC14 — cross-tab sync. Simulate "another tab" by writing a valid record
// directly to localStorage (bypassing this tab's provider) and then
// dispatching a `storage` event on `window`, exactly as browsers do for
// real cross-tab localStorage mutations (jsdom does not fire this
// automatically for same-window writes).

function makeRecord(
  decision: 'granted' | 'denied',
  overrides: Partial<ConsentRecord> = {},
): ConsentRecord {
  return {
    categories: { default: decision },
    policyVersion: '1',
    timestamp: new Date().toISOString(),
    method: 'dialog',
    ...overrides,
  };
}

function writeFromOtherTab(record: ConsentRecord) {
  const value = JSON.stringify(record);
  window.localStorage.setItem(DEFAULT_STORAGE_KEY, value);
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: DEFAULT_STORAGE_KEY,
        newValue: value,
        storageArea: window.localStorage,
      }),
    );
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('cross-tab consent sync (AC14)', () => {
  it('another tab granting closes the dialog and mounts trackers here', async () => {
    render(
      <CipaProvider>
        <CipaTracking>
          <div data-testid="tracked">tracked</div>
        </CipaTracking>
      </CipaProvider>,
    );

    expect(await screen.findByRole('dialog')).not.toBeNull();
    expect(screen.queryByTestId('tracked')).toBeNull();

    writeFromOtherTab(makeRecord('granted'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.queryByTestId('tracked')).not.toBeNull();
  });

  it('another tab revoking (denied) unmounts trackers here without reloading', async () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
      configurable: true,
    });

    render(
      <CipaProvider>
        <CipaTracking>
          <div data-testid="tracked">tracked</div>
        </CipaTracking>
      </CipaProvider>,
    );

    // Establish granted state in this tab first.
    writeFromOtherTab(makeRecord('granted'));
    await waitFor(() => {
      expect(screen.queryByTestId('tracked')).not.toBeNull();
    });

    // Now another tab revokes (denies) consent.
    writeFromOtherTab(makeRecord('denied'));

    await waitFor(() => {
      expect(screen.queryByTestId('tracked')).toBeNull();
    });
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('with reloadOnRevoke, a cross-tab revoke triggers location.reload here too', async () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
      configurable: true,
    });

    render(
      <CipaProvider reloadOnRevoke>
        <CipaTracking>
          <div data-testid="tracked">tracked</div>
        </CipaTracking>
      </CipaProvider>,
    );

    writeFromOtherTab(makeRecord('granted'));
    await waitFor(() => {
      expect(screen.queryByTestId('tracked')).not.toBeNull();
    });

    writeFromOtherTab(makeRecord('denied'));

    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });
  });
});
