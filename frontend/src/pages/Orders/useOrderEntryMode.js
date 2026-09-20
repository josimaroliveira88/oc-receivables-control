import { useCallback, useState } from 'react';

// Order entry mode: how the user prefers to fill in the order items.
//  - 'detailed'    -> current per-item form (default, preserves old behavior)
//  - 'spreadsheet' -> spreadsheet/planilha layout based on the order simulator
export const ORDER_ENTRY_MODE_KEY = 'oc-order-entry-mode';

export const ENTRY_MODES = {
  DETAILED: 'detailed',
  SPREADSHEET: 'spreadsheet',
};

// Reads the stored preference, falling back to the detailed form for any
// missing, invalid or unreadable value so the default behavior never changes.
export const readStoredEntryMode = () => {
  try {
    const stored = window.localStorage.getItem(ORDER_ENTRY_MODE_KEY);
    return stored === ENTRY_MODES.SPREADSHEET
      ? ENTRY_MODES.SPREADSHEET
      : ENTRY_MODES.DETAILED;
  } catch (_err) {
    return ENTRY_MODES.DETAILED;
  }
};

export const storeEntryMode = (mode) => {
  try {
    window.localStorage.setItem(ORDER_ENTRY_MODE_KEY, mode);
  } catch (_err) {
    // Storage can be unavailable (private mode / disabled). The preference
    // simply does not persist; the session still works.
  }
};

// Owns the current entry mode and the saved default. The current mode can
// change at any time; the default is only updated when the user explicitly
// confirms it after switching.
export function useOrderEntryMode() {
  const [entryMode, setEntryMode] = useState(readStoredEntryMode);
  const [defaultEntryMode, setDefaultEntryMode] = useState(readStoredEntryMode);

  const applyEntryMode = useCallback((mode) => {
    setEntryMode(mode);
  }, []);

  const saveEntryModeAsDefault = useCallback((mode) => {
    storeEntryMode(mode);
    setDefaultEntryMode(mode);
  }, []);

  return {
    entryMode,
    defaultEntryMode,
    applyEntryMode,
    saveEntryModeAsDefault,
  };
}
