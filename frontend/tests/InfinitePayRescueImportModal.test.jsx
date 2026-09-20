import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InfinitePayRescueImportModal from '../src/pages/Sales/components/InfinitePayRescueImportModal';

const match = (saleId, extra = {}) => ({
  saleId,
  orderNumber: `V-${saleId}`,
  clientName: 'Cliente',
  totalCents: 22001,
  pendingCents: 22001,
  rescuableCents: 22001,
  matchType: 'net',
  matchedCents: 22001,
  suggestedCents: 22001,
  diffCents: 0,
  ...extra,
});

const rescue = (overrides = {}) => ({
  line: 2,
  date: '2026-09-16',
  time: '08:50',
  name: 'Pix CASSIA GOUVEIA LIMA',
  amountCents: 22001,
  paired: true,
  sourceDeposits: [],
  matches: [match('s1')],
  ...overrides,
});

const sale = (overrides = {}) => ({
  saleId: 's1',
  orderNumber: 'V-0001',
  clientName: 'Cliente',
  totalCents: 22001,
  pendingCents: 22001,
  rescuableCents: 22001,
  ...overrides,
});

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onToggleRow: vi.fn(),
  onAssignMatch: vi.fn(),
  onAssignFromDeposit: vi.fn(),
  onToggleSale: vi.fn(),
  onSetAssignmentAmount: vi.fn(),
  onRemoveAssignment: vi.fn(),
  onCommit: vi.fn(),
  onUndo: vi.fn(),
};

describe('InfinitePayRescueImportModal', () => {
  it('lists the rescues and the ready count', () => {
    render(
      <InfinitePayRescueImportModal
        {...baseProps}
        rescues={[rescue()]}
        candidateSales={[sale()]}
        assignments={{ 2: [{ orderId: 's1', amountCents: 22001 }] }}
      />,
    );

    expect(
      screen.getByTestId('infinitepay-rescue-import-modal'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('rescue-row-2')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent.includes('1 resgate(s) encontrado') &&
          element.textContent.includes('1 pronto(s) para confirmar'),
      ),
    ).toBeInTheDocument();
  });

  it('expands a rescue and assigns a suggested match', () => {
    const onAssignMatch = vi.fn();
    render(
      <InfinitePayRescueImportModal
        {...baseProps}
        onAssignMatch={onAssignMatch}
        expandedLine={2}
        rescues={[rescue()]}
        candidateSales={[sale()]}
        assignments={{}}
      />,
    );

    fireEvent.click(screen.getByTestId('rescue-expand-2'));
    expect(baseProps.onToggleRow).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByTestId('rescue-match-2-s1'));
    expect(onAssignMatch).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ saleId: 's1' }),
    );
  });

  it('toggles a manually selected sale', () => {
    const onToggleSale = vi.fn();
    render(
      <InfinitePayRescueImportModal
        {...baseProps}
        onToggleSale={onToggleSale}
        expandedLine={2}
        rescues={[rescue()]}
        candidateSales={[sale()]}
        assignments={{}}
      />,
    );

    fireEvent.click(screen.getByTestId('rescue-sale-2-s1'));
    expect(onToggleSale).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ saleId: 's1' }),
    );
  });

  it('disables the confirm button when nothing is balanced', () => {
    render(
      <InfinitePayRescueImportModal
        {...baseProps}
        rescues={[rescue()]}
        candidateSales={[sale()]}
        assignments={{}}
      />,
    );

    expect(screen.getByTestId('infinitepay-rescue-confirm')).toBeDisabled();
  });

  it('confirms when a rescue is balanced', () => {
    const onCommit = vi.fn();
    render(
      <InfinitePayRescueImportModal
        {...baseProps}
        onCommit={onCommit}
        rescues={[rescue()]}
        candidateSales={[sale()]}
        assignments={{ 2: [{ orderId: 's1', amountCents: 22001 }] }}
      />,
    );

    const button = screen.getByTestId('infinitepay-rescue-confirm');
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('shows the success state with the undo action', () => {
    const onUndo = vi.fn();
    render(
      <InfinitePayRescueImportModal
        {...baseProps}
        onUndo={onUndo}
        committedBatchId="batch-1"
        committedCount={2}
        rescues={[rescue()]}
        candidateSales={[sale()]}
        assignments={{}}
      />,
    );

    expect(
      screen.getByTestId('infinitepay-rescue-import-success'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('infinitepay-rescue-undo'));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('shows the error message', () => {
    render(
      <InfinitePayRescueImportModal
        {...baseProps}
        error="Linha 2: dado inválido."
        rescues={[]}
        candidateSales={[]}
        assignments={{}}
      />,
    );

    expect(
      screen.getByTestId('infinitepay-rescue-import-error'),
    ).toHaveTextContent('Linha 2: dado inválido.');
  });
});
