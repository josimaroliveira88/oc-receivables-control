import React, { useRef } from 'react';
import { Download } from 'lucide-react';
import { useInfinitePayRescueImport } from '../useInfinitePayRescueImport';
import InfinitePayRescueImportModal from './InfinitePayRescueImportModal';

// Self-contained "Importar resgates InfinitePay" action: owns the hidden file
// input, the statement-import hook and the modal, so the sales page only wires
// the refresh callbacks.
const InfinitePayRescueImport = ({ onCommitted, onUndone }) => {
  const {
    isOpen,
    submitting,
    committing,
    error,
    rescues,
    candidateSales,
    assignments,
    expandedLine,
    committedBatchId,
    committedCount,
    importFile,
    close,
    toggleRow,
    assignMatch,
    assignFromDeposit,
    toggleSale,
    setAssignmentAmount,
    removeAssignment,
    commit,
    undoCommitted,
  } = useInfinitePayRescueImport({ onCommitted, onUndone });

  const inputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) importFile(file);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={submitting}
        data-testid="infinitepay-rescue-import-button"
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-line text-ink-soft hover:text-ink hover:bg-elevated font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Importar resgates
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        data-testid="infinitepay-rescue-file-input"
        onChange={handleFileChange}
      />

      <InfinitePayRescueImportModal
        isOpen={isOpen}
        rescues={rescues}
        candidateSales={candidateSales}
        assignments={assignments}
        expandedLine={expandedLine}
        error={error}
        submitting={submitting}
        committing={committing}
        committedBatchId={committedBatchId}
        committedCount={committedCount}
        onClose={close}
        onToggleRow={toggleRow}
        onAssignMatch={assignMatch}
        onAssignFromDeposit={assignFromDeposit}
        onToggleSale={toggleSale}
        onSetAssignmentAmount={setAssignmentAmount}
        onRemoveAssignment={removeAssignment}
        onCommit={commit}
        onUndo={undoCommitted}
        onRequestFile={() => inputRef.current?.click()}
      />
    </>
  );
};

export default InfinitePayRescueImport;
