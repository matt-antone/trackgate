import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsentProvider } from '../src/ConsentProvider';
import { ConsentGate } from '../src/ConsentGate';
import { useConsent } from '../src/useConsent';
import { DEFAULT_STORAGE_KEY } from '../src/storage';
import { TrackerChild, readStored, dialogIsShown, renderGated } from './helpers';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Controls() {
  const { revoke } = useConsent();
  return <button onClick={() => revoke()}>revoke</button>;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('recordId', () => {
  test('grant produces a record with a non-empty string recordId', async () => {
    const user = userEvent.setup();

    renderGated();

    const acceptButton = await screen.findByText('Accept');
    await user.click(acceptButton);

    const stored = readStored();
    expect(typeof stored?.recordId).toBe('string');
    expect(stored?.recordId.length).toBeGreaterThan(0);
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      expect(stored?.recordId).toHaveLength(36);
      expect(stored?.recordId).toMatch(UUID_SHAPE);
    }
  });

  test('a later revoke writes a different recordId than the grant', async () => {
    const user = userEvent.setup();

    render(
      <ConsentProvider>
        <Controls />
        <ConsentGate>
          <TrackerChild />
        </ConsentGate>
      </ConsentProvider>,
    );

    const acceptButton = await screen.findByText('Accept');
    await user.click(acceptButton);
    const grantedRecordId = readStored()?.recordId;

    await user.click(screen.getByText('revoke'));
    const revokedRecordId = readStored()?.recordId;

    expect(grantedRecordId).toBeTruthy();
    expect(revokedRecordId).toBeTruthy();
    expect(revokedRecordId).not.toBe(grantedRecordId);
  });

  test('a stored record missing recordId is treated as pending (re-prompt)', () => {
    const record = {
      categories: { default: 'granted' },
      policyVersion: '1',
      timestamp: new Date().toISOString(),
      method: 'dialog',
      // recordId intentionally omitted
    };
    window.localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(record));

    renderGated();

    expect(dialogIsShown()).toBe(true);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });
});
