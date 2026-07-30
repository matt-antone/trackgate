import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_STORAGE_KEY } from '../src/storage';
import { readStored, seedRecord, dialogIsShown, renderGated } from './helpers';

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('AC3 — decline persists', () => {
  test('clicking Decline stores a denied record; a fresh provider render shows no dialog and mounts no trackers', async () => {
    const user = userEvent.setup();

    const { unmount } = renderGated();

    const declineButton = await screen.findByText('Decline');
    await user.click(declineButton);

    const stored = readStored();
    expect(stored).not.toBeNull();
    expect(stored?.categories.default).toBe('denied');
    expect(stored?.policyVersion).toBe('1');
    expect(typeof stored?.timestamp).toBe('string');

    unmount();

    renderGated();

    expect(dialogIsShown()).toBe(false);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });
});

describe('AC4 — grant persists', () => {
  test('clicking Accept stores a granted record; a fresh provider render mounts trackers with no dialog', async () => {
    const user = userEvent.setup();

    const { unmount } = renderGated();

    const acceptButton = await screen.findByText('Accept');
    await user.click(acceptButton);

    const stored = readStored();
    expect(stored?.categories.default).toBe('granted');

    unmount();

    renderGated();

    expect(dialogIsShown()).toBe(false);
    expect(document.body.contains(screen.getByTestId('tracker'))).toBe(true);
  });
});

describe('AC6 — policy version bump', () => {
  test('stored policyVersion "1" + provider policyVersion "2" resets to pending and re-shows the dialog', () => {
    seedRecord({ policyVersion: '1', categories: { default: 'granted' } });

    renderGated({ policyVersion: '2' });

    expect(dialogIsShown()).toBe(true);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });
});

describe('AC7 — TTL', () => {
  test('granted record older than ttlDays is treated as pending', () => {
    seedRecord({
      categories: { default: 'granted' },
      timestamp: isoDaysAgo(5),
    });

    renderGated({ ttlDays: 3 });

    expect(dialogIsShown()).toBe(true);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });

  test('denied record is unaffected by ttlDays', () => {
    seedRecord({
      categories: { default: 'denied' },
      timestamp: isoDaysAgo(5),
    });

    renderGated({ ttlDays: 3 });

    expect(dialogIsShown()).toBe(false);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });
});

describe('AC7b — decline TTL (opt-in)', () => {
  test('with declineTtlDays set, an old denied record expires back to pending', () => {
    seedRecord({
      categories: { default: 'denied' },
      timestamp: isoDaysAgo(10),
    });

    renderGated({ declineTtlDays: 7 });

    expect(dialogIsShown()).toBe(true);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });

  test('without declineTtlDays, a denied record never expires', () => {
    seedRecord({
      categories: { default: 'denied' },
      timestamp: isoDaysAgo(3650),
    });

    renderGated();

    expect(dialogIsShown()).toBe(false);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });
});

describe('AC10 — corrupt storage fails closed', () => {
  test('unparseable JSON: status pending, no throw', () => {
    window.localStorage.setItem(DEFAULT_STORAGE_KEY, '{not valid json');

    expect(() => renderGated()).not.toThrow();

    expect(dialogIsShown()).toBe(true);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });

  test('malformed shape (valid JSON, wrong structure): status pending, no throw', () => {
    window.localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));

    expect(() => renderGated()).not.toThrow();

    expect(dialogIsShown()).toBe(true);
    expect(screen.queryByTestId('tracker')).toBeNull();
  });
});
