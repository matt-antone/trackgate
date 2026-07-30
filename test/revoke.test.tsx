import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentProvider } from '../src/ConsentProvider';
import { ConsentGate } from '../src/ConsentGate';
import { useConsent } from '../src/useConsent';
import { DEFAULT_STORAGE_KEY } from '../src/storage';
import { TrackerChild, readStored, seedRecord, dialogIsShown } from './helpers';

function Controls() {
  const { revoke, reset } = useConsent();
  return (
    <div>
      <button onClick={() => revoke()}>revoke</button>
      <button onClick={() => reset()}>reset</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('AC5 — revoke', () => {
  test('revoke() flips status to denied, unmounts tracker children, and updates storage', async () => {
    const user = userEvent.setup();
    seedRecord();

    render(
      <ConsentProvider>
        <Controls />
        <ConsentGate>
          <TrackerChild />
        </ConsentGate>
      </ConsentProvider>,
    );

    // Granted record hydrated: tracker mounted, no dialog.
    expect(document.body.contains(screen.getByTestId('tracker'))).toBe(true);
    expect(dialogIsShown()).toBe(false);

    await user.click(screen.getByText('revoke'));

    expect(screen.queryByTestId('tracker')).toBeNull();

    const stored = readStored();
    expect(stored?.categories.default).toBe('denied');
    expect(stored?.method).toBe('api');
  });
});

describe('reset()', () => {
  test('reset() clears the stored record, status returns to pending, and the dialog re-appears', async () => {
    const user = userEvent.setup();
    seedRecord();

    render(
      <ConsentProvider>
        <Controls />
        <ConsentGate>
          <TrackerChild />
        </ConsentGate>
      </ConsentProvider>,
    );

    expect(document.body.contains(screen.getByTestId('tracker'))).toBe(true);
    expect(dialogIsShown()).toBe(false);

    await user.click(screen.getByText('reset'));

    expect(window.localStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();
    expect(screen.queryByTestId('tracker')).toBeNull();
    expect(dialogIsShown()).toBe(true);
  });
});
