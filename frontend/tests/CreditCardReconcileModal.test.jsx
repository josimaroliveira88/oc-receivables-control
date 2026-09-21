import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreditCardReconcileModal from '../src/pages/CreditCards/components/CreditCardReconcileModal';
import { useCreditCardReconcile } from '../src/pages/CreditCards/useCreditCardReconcile';

const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: () => vi.fn(),
    post: (...args) => mockPost(...args),
    put: () => vi.fn(),
    delete: (...args) => mockDelete(...args),
  },
}));

const installmentMatch = (
  id,
  number,
  total,
  description = 'Compra de teste',
) => ({
  id,
  description,
  amountCents: 10000,
  effectiveDate: '2026-09-15T00:00:00.000Z',
  installmentNumber: number,
  installmentsTotal: total,
});

const preview = (lines) => ({
  batchId: 'batch-1',
  statementLines: lines,
});

const matchedLine = {
  date: '2026-09-15',
  amountCents: 10000,
  type: 'PURCHASE',
  fitid: 'FIT-1',
  memo: 'COMPRA TESTE',
  matches: [installmentMatch('inst-1', 1, 3), installmentMatch('inst-2', 2, 3)],
  suggestedInstallmentId: 'inst-1',
};

const unmatchedLine = {
  date: '2026-09-16',
  amountCents: 5000,
  type: 'PURCHASE',
  fitid: 'FIT-2',
  memo: 'SEM MATCH',
  matches: [],
  suggestedInstallmentId: null,
};

const Harness = () => {
  const reconcile = useCreditCardReconcile();
  return (
    <>
      <button type="button" onClick={reconcile.open}>
        Abrir importação
      </button>
      <CreditCardReconcileModal
        isOpen={reconcile.isOpen}
        onClose={reconcile.close}
        onImportFile={reconcile.importFile}
        statementLines={reconcile.statementLines}
        selections={reconcile.selections}
        error={reconcile.error}
        submitting={reconcile.submitting}
        committing={reconcile.committing}
        committedBatchId={reconcile.committedBatchId}
        committedCount={reconcile.committedCount}
        onSelectionChange={reconcile.setSelection}
        onCommit={reconcile.commit}
        onUndo={reconcile.undoCommitted}
      />
    </>
  );
};

const openAndUpload = async (
  ofxText = '<OFX><BANKTRANLIST></BANKTRANLIST></OFX>',
) => {
  fireEvent.click(screen.getByRole('button', { name: 'Abrir importação' }));
  const input = await screen.findByTestId('credit-card-reconcile-file-input');
  const file = new File([ofxText], 'extrato.ofx', { type: 'text/plain' });
  fireEvent.change(input, { target: { files: [file] } });
};

describe('CreditCardReconcileModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockImplementation((url) => {
      if (url === '/credit-cards/reconcile/preview')
        return Promise.resolve({ data: preview([matchedLine, unmatchedLine]) });
      if (url === '/credit-cards/reconcile/commit')
        return Promise.resolve({
          data: { batchId: 'batch-1', updated: [{ id: 'inst-1' }] },
        });
      return Promise.resolve({ data: {} });
    });
    mockDelete.mockResolvedValue({ data: { batchId: 'batch-1', restored: 1 } });
  });

  it('previews the OFX and renders the suggested installments', async () => {
    render(<Harness />);
    await openAndUpload('<OFX>conteudo</OFX>');

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/credit-cards/reconcile/preview',
        expect.objectContaining({
          ofxText: expect.stringContaining('<OFX>'),
        }),
      ),
    );

    expect(
      await screen.findByTestId('reconcile-line-FIT-1'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('reconcile-select-FIT-1')).toHaveValue('inst-1');
    expect(screen.getByText('COMPRA TESTE')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma parcela sugerida')).toBeInTheDocument();
  });

  it('lets the user unlink a suggestion', async () => {
    render(<Harness />);
    await openAndUpload();
    await screen.findByTestId('reconcile-select-FIT-1');

    fireEvent.change(screen.getByTestId('reconcile-select-FIT-1'), {
      target: { value: '' },
    });

    expect(screen.getByTestId('reconcile-select-FIT-1')).toHaveValue('');
  });

  it('lets the user link a line to another installment', async () => {
    render(<Harness />);
    await openAndUpload();
    await screen.findByTestId('reconcile-select-FIT-1');

    fireEvent.change(screen.getByTestId('reconcile-select-FIT-1'), {
      target: { value: 'inst-2' },
    });

    expect(screen.getByTestId('reconcile-select-FIT-1')).toHaveValue('inst-2');
  });

  it('commits the confirmed matches and closes the modal', async () => {
    render(<Harness />);
    await openAndUpload();
    await screen.findByTestId('reconcile-select-FIT-1');

    fireEvent.click(screen.getByTestId('credit-card-reconcile-confirm'));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/credit-cards/reconcile/commit', {
        batchId: 'batch-1',
        matches: [
          {
            statementFitid: 'FIT-1',
            statementDate: '2026-09-15',
            installmentId: 'inst-1',
          },
        ],
      }),
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId('credit-card-reconcile-modal'),
      ).not.toBeInTheDocument(),
    );
  });

  it('undoes the last committed batch', async () => {
    render(<Harness />);
    await openAndUpload();
    await screen.findByTestId('reconcile-select-FIT-1');

    fireEvent.click(screen.getByTestId('credit-card-reconcile-confirm'));

    fireEvent.click(await screen.findByTestId('credit-card-reconcile-undo'));

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith(
        '/credit-cards/reconcile/batch/batch-1',
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId('credit-card-reconcile-banner'),
      ).not.toBeInTheDocument(),
    );
  });

  it('shows fewer matches when the same OFX is re-imported', async () => {
    render(<Harness />);
    await openAndUpload();
    await screen.findByTestId('reconcile-select-FIT-1');

    fireEvent.click(screen.getByTestId('credit-card-reconcile-confirm'));

    mockPost.mockImplementation((url) => {
      if (url === '/credit-cards/reconcile/preview')
        return Promise.resolve({
          data: preview([
            { ...matchedLine, matches: [], suggestedInstallmentId: null },
            unmatchedLine,
          ]),
        });
      return Promise.resolve({ data: {} });
    });

    fireEvent.click(await screen.findByTestId('credit-card-reconcile-undo'));
    await waitFor(() =>
      expect(
        screen.queryByTestId('credit-card-reconcile-banner'),
      ).not.toBeInTheDocument(),
    );

    await openAndUpload();
    await screen.findByTestId('reconcile-line-FIT-1');

    expect(screen.getAllByText('Nenhuma parcela sugerida').length).toBe(2);
  });
});
