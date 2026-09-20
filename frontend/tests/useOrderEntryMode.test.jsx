import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  ORDER_ENTRY_MODE_KEY,
  ENTRY_MODES,
  readStoredEntryMode,
  storeEntryMode,
  useOrderEntryMode,
} from '../src/pages/Orders/useOrderEntryMode';

describe('order entry mode storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to the detailed form when nothing is stored', () => {
    expect(readStoredEntryMode()).toBe(ENTRY_MODES.DETAILED);
  });

  it('reads a stored spreadsheet preference', () => {
    localStorage.setItem(ORDER_ENTRY_MODE_KEY, ENTRY_MODES.SPREADSHEET);
    expect(readStoredEntryMode()).toBe(ENTRY_MODES.SPREADSHEET);
  });

  it('falls back to detailed for an unknown stored value', () => {
    localStorage.setItem(ORDER_ENTRY_MODE_KEY, 'nonsense');
    expect(readStoredEntryMode()).toBe(ENTRY_MODES.DETAILED);
  });

  it('persists the selected mode', () => {
    storeEntryMode(ENTRY_MODES.SPREADSHEET);
    expect(localStorage.getItem(ORDER_ENTRY_MODE_KEY)).toBe(
      ENTRY_MODES.SPREADSHEET,
    );
  });

  it('never throws when storage fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readStoredEntryMode()).toBe(ENTRY_MODES.DETAILED);
  });
});

describe('useOrderEntryMode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts on the stored default', () => {
    localStorage.setItem(ORDER_ENTRY_MODE_KEY, ENTRY_MODES.SPREADSHEET);
    const { result } = renderHook(() => useOrderEntryMode());
    expect(result.current.entryMode).toBe(ENTRY_MODES.SPREADSHEET);
    expect(result.current.defaultEntryMode).toBe(ENTRY_MODES.SPREADSHEET);
  });

  it('changes the current mode without touching the default', () => {
    const { result } = renderHook(() => useOrderEntryMode());
    act(() => result.current.applyEntryMode(ENTRY_MODES.SPREADSHEET));
    expect(result.current.entryMode).toBe(ENTRY_MODES.SPREADSHEET);
    expect(result.current.defaultEntryMode).toBe(ENTRY_MODES.DETAILED);
    expect(localStorage.getItem(ORDER_ENTRY_MODE_KEY)).toBeNull();
  });

  it('saves the default and persists it', () => {
    const { result } = renderHook(() => useOrderEntryMode());
    act(() => result.current.saveEntryModeAsDefault(ENTRY_MODES.SPREADSHEET));
    expect(result.current.defaultEntryMode).toBe(ENTRY_MODES.SPREADSHEET);
    expect(localStorage.getItem(ORDER_ENTRY_MODE_KEY)).toBe(
      ENTRY_MODES.SPREADSHEET,
    );
  });
});
