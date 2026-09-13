import { useState } from 'react';
import { createEmptyRow } from './utils/simulatorHelpers';

// Ephemeral state for the order simulator. Nothing here is persisted: opening
// the simulator resets the rows, and closing it discards them entirely.
export function useOrderSimulator() {
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState([]);

  const openSimulator = () => {
    setRows([]);
    setIsOpen(true);
  };

  const closeSimulator = () => {
    setIsOpen(false);
    setRows([]);
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);

  const removeRow = (id) =>
    setRows((prev) => prev.filter((row) => row.id !== id));

  const updateRowField = (id, field, value) =>
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );

  const clearAll = () => setRows([]);

  return {
    isOpen,
    rows,
    openSimulator,
    closeSimulator,
    addRow,
    removeRow,
    updateRowField,
    clearAll,
  };
}
