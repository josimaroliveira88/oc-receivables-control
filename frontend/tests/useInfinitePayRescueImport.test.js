import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInfinitePayRescueImport } from '../src/pages/Sales/useInfinitePayRescueImport';

const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    post: (...args) => mockPost(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

const rescue = (overrides = {}) => ({
  line: 2,
  date: '2026-09-16',
  time: '08:50',
  name: 'Pix CASSIA GOUVEIA LIMA',
  amountCents: 22001,
  paired: true,
  sourceDeposits: [],
  matches: [],
  ...overrides,
});

const match = (saleId, extra = {}) => ({
  saleId,
  orderNumber: `V-${saleId}`,
  clientName: 'Cliente',
  totalCents: 22001,
  pendingCents: 22001,
  rescuableCents: 22001,
  matchType: 'net',
  suggestedCents: 22001,
  diffCents: 0,
  ...extra,
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

const importPreview = (body) => {
  mockPost.mockResolvedValueOnce({
    data: { batchId: 'batch-1', rescues: [], candidateSales: [], ...body },
  });
};

describe('useInfinitePayRescueImport', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockDelete.mockReset();
  });

  it('imports a file and pre-fills a single-sale rescue', async () => {
    importPreview({
      rescues: [rescue({ matches: [match('s1')] })],
      candidateSales: [sale()],
    });
    const { result } = renderHook(() => useInfinitePayRescueImport());

    await act(async () => {
      await result.current.importFile(new File(['x'], 'extrato.csv'));
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/sales/infinitepay-rescues/import',
      expect.any(FormData),
    );
    expect(result.current.isOpen).toBe(true);
    expect(result.current.batchId).toBe('batch-1');
    expect(result.current.rescues).toHaveLength(1);
    expect(result.current.assignments).toEqual({
      2: [{ orderId: 's1', amountCents: 22001 }],
    });
  });

  it('shows the backend error when the file is rejected', async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { error: 'Linha 2: data inválida.' } },
    });
    const { result } = renderHook(() => useInfinitePayRescueImport());

    await act(async () => {
      await result.current.importFile(new File(['x'], 'extrato.csv'));
    });

    expect(result.current.error).toBe('Linha 2: data inválida.');
    expect(result.current.rescues).toEqual([]);
  });

  it('toggles the expanded row', () => {
    const { result } = renderHook(() => useInfinitePayRescueImport());
    act(() => result.current.toggleRow(2));
    expect(result.current.expandedLine).toBe(2);
    act(() => result.current.toggleRow(2));
    expect(result.current.expandedLine).toBeNull();
  });

  it('assigns a suggested match', () => {
    const { result } = renderHook(() => useInfinitePayRescueImport());
    act(() => result.current.assignMatch(2, match('s9')));
    expect(result.current.assignments[2]).toEqual([
      { orderId: 's9', amountCents: 22001 },
    ]);
  });

  it('adds and removes manual sales with the default amount', () => {
    const { result } = renderHook(() => useInfinitePayRescueImport());
    act(() => result.current.toggleSale(2, sale({ rescuableCents: 15000 })));
    expect(result.current.assignments[2]).toEqual([
      { orderId: 's1', amountCents: 15000 },
    ]);
    act(() => result.current.toggleSale(2, sale({ rescuableCents: 15000 })));
    expect(result.current.assignments[2]).toEqual([]);
  });

  it('builds a composition from source deposits and replaces one deposit', () => {
    const { result } = renderHook(() => useInfinitePayRescueImport());

    act(() =>
      result.current.assignFromDeposit(2, {
        depositKey: '2-0',
        orderId: 's1',
        amountCents: 33415,
      }),
    );
    act(() =>
      result.current.assignFromDeposit(2, {
        depositKey: '2-1',
        orderId: 's2',
        amountCents: 16117,
      }),
    );
    expect(result.current.assignments[2]).toEqual([
      { orderId: 's1', amountCents: 33415, sourceKey: '2-0' },
      { orderId: 's2', amountCents: 16117, sourceKey: '2-1' },
    ]);

    act(() =>
      result.current.assignFromDeposit(2, {
        depositKey: '2-0',
        orderId: 's3',
        amountCents: 33415,
      }),
    );
    expect(result.current.assignments[2]).toEqual([
      { orderId: 's2', amountCents: 16117, sourceKey: '2-1' },
      { orderId: 's3', amountCents: 33415, sourceKey: '2-0' },
    ]);
  });

  it('updates and removes an assignment amount', () => {
    const { result } = renderHook(() => useInfinitePayRescueImport());
    act(() => result.current.toggleSale(2, sale()));
    act(() => result.current.setAssignmentAmount(2, 's1', 12345));
    expect(result.current.assignments[2][0].amountCents).toBe(12345);
    act(() => result.current.removeAssignment(2, 's1'));
    expect(result.current.assignments[2]).toEqual([]);
  });

  it('commits only the balanced rescues and notifies the caller', async () => {
    importPreview({
      rescues: [
        rescue({ line: 2, matches: [match('s1')] }),
        rescue({ line: 4, amountCents: 5000, matches: [] }),
      ],
      candidateSales: [sale()],
    });
    mockPost.mockResolvedValueOnce({
      data: { batchId: 'batch-1', created: [{ id: 't1' }] },
    });
    const onCommitted = vi.fn();
    const { result } = renderHook(() =>
      useInfinitePayRescueImport({ onCommitted }),
    );

    await act(async () => {
      await result.current.importFile(new File(['x'], 'extrato.csv'));
    });
    await act(async () => {
      await result.current.commit();
    });

    expect(mockPost).toHaveBeenLastCalledWith(
      '/sales/infinitepay-rescues/commit',
      {
        batchId: 'batch-1',
        rescues: [
          {
            line: 2,
            rescueAmountCents: 22001,
            transactionDate: '2026-09-16',
            assignments: [{ orderId: 's1', amountCents: 22001 }],
          },
        ],
      },
    );
    expect(result.current.committedBatchId).toBe('batch-1');
    expect(result.current.committedCount).toBe(1);
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });

  it('does not call the API when no rescue is balanced', async () => {
    mockPost.mockReset();
    const { result } = renderHook(() => useInfinitePayRescueImport());
    await act(async () => {
      await result.current.commit();
    });
    expect(mockPost).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/pronto para confirmar/);
  });

  it('surfaces a commit error from the backend', async () => {
    importPreview({
      rescues: [rescue({ matches: [match('s1')] })],
      candidateSales: [sale()],
    });
    mockPost.mockRejectedValueOnce({
      response: { data: { error: 'Já existe um resgate' } },
    });
    const { result } = renderHook(() => useInfinitePayRescueImport());

    await act(async () => {
      await result.current.importFile(new File(['x'], 'extrato.csv'));
    });
    await act(async () => {
      await result.current.commit();
    });

    expect(result.current.error).toBe('Já existe um resgate');
    expect(result.current.committedBatchId).toBeNull();
  });

  it('undoes the committed batch and resets the state', async () => {
    importPreview({
      rescues: [rescue({ matches: [match('s1')] })],
      candidateSales: [sale()],
    });
    mockPost.mockResolvedValueOnce({
      data: { batchId: 'batch-1', created: [{ id: 't1' }] },
    });
    mockDelete.mockResolvedValueOnce({ data: { deleted: 1 } });
    const onUndone = vi.fn();
    const { result } = renderHook(() =>
      useInfinitePayRescueImport({ onUndone }),
    );

    await act(async () => {
      await result.current.importFile(new File(['x'], 'extrato.csv'));
    });
    await act(async () => {
      await result.current.commit();
    });
    await act(async () => {
      await result.current.undoCommitted();
    });

    expect(mockDelete).toHaveBeenCalledWith(
      '/finances/settlements/batch/batch-1',
    );
    expect(onUndone).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.rescues).toEqual([]);
    expect(result.current.committedBatchId).toBeNull();
  });

  it('resets the state on close', async () => {
    importPreview({
      rescues: [rescue({ matches: [match('s1')] })],
      candidateSales: [sale()],
    });
    const { result } = renderHook(() => useInfinitePayRescueImport());
    await act(async () => {
      await result.current.importFile(new File(['x'], 'extrato.csv'));
    });
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.rescues).toEqual([]);
    expect(result.current.assignments).toEqual({});
  });
});
