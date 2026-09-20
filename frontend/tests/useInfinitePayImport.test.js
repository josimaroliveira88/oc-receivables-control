import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInfinitePayImport } from '../src/pages/Sales/useInfinitePayImport';

const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    post: (...args) => mockPost(...args),
    get: (...args) => mockGet(...args),
  },
}));

const csvRow = (overrides = {}) => ({
  line: 2,
  valorCents: 23402,
  liquidoCents: 22001,
  date: '2026-09-16',
  nsu: 'abc-123',
  ...overrides,
});

describe('useInfinitePayImport', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
  });

  it('imports a file and stores the rows and ignored count', async () => {
    mockPost.mockResolvedValue({
      data: { rows: [csvRow()], ignoredCount: 3 },
    });
    const { result } = renderHook(() => useInfinitePayImport());

    await act(async () => {
      await result.current.importFile(new File(['x'], 'extrato.csv'));
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/sales/infinitepay/import',
      expect.any(FormData),
    );
    expect(result.current.isOpen).toBe(true);
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.ignoredCount).toBe(3);
    expect(result.current.submitting).toBe(false);
  });

  it('opens the modal with the error when the CSV is rejected', async () => {
    mockPost.mockRejectedValue({
      response: { data: { error: 'Linha 3: data inválida.' } },
    });
    const { result } = renderHook(() => useInfinitePayImport());

    await act(async () => {
      await result.current.importFile(new File(['x'], 'extrato.csv'));
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.error).toBe('Linha 3: data inválida.');
    expect(result.current.rows).toEqual([]);
  });

  it('uses a generic message when the request fails without one', async () => {
    mockPost.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useInfinitePayImport());

    await act(async () => {
      await result.current.importFile(new File(['x'], 'extrato.csv'));
    });

    expect(result.current.error).toMatch(/Não foi possível importar/);
  });

  it('toggles the expanded row', () => {
    const { result } = renderHook(() => useInfinitePayImport());

    act(() => result.current.toggleRow(2));
    expect(result.current.expandedLine).toBe(2);

    act(() => result.current.toggleRow(2));
    expect(result.current.expandedLine).toBeNull();
  });

  it('opens a pre-filled payment form and marks the row used on submit', async () => {
    const sale = { id: 's1', orderNumber: 'V-0001' };
    mockGet.mockResolvedValue({ data: sale });
    const openPrefilled = vi.fn();
    const { result } = renderHook(() =>
      useInfinitePayImport({ openPrefilled }),
    );

    const row = csvRow();
    const match = { saleId: 's1', matchType: 'net' };

    await act(async () => {
      await result.current.selectSale(row, match);
    });

    expect(mockGet).toHaveBeenCalledWith('/sales/s1');
    expect(openPrefilled).toHaveBeenCalledTimes(1);
    const [passedSale, prefill] = openPrefilled.mock.calls[0];
    expect(passedSale).toBe(sale);
    expect(prefill.paymentType).toBe('INFINITE_PAY');
    expect(prefill.paymentAmount).toBe('234.02');
    expect(prefill.paymentNetAmount).toBe('220.01');
    expect(prefill.passesGatewayFeeToClient).toBe(true);
    expect(result.current.isOpen).toBe(false);

    act(() => prefill.onDone(true));
    expect(result.current.usedLines.has(2)).toBe(true);
    expect(result.current.isOpen).toBe(true);
  });

  it('keeps the row unused when the payment is cancelled', async () => {
    const sale = { id: 's1', orderNumber: 'V-0001' };
    mockGet.mockResolvedValue({ data: sale });
    const openPrefilled = vi.fn();
    const { result } = renderHook(() =>
      useInfinitePayImport({ openPrefilled }),
    );

    await act(async () => {
      await result.current.selectSale(csvRow(), {
        saleId: 's1',
        matchType: 'gross',
      });
    });

    const [, prefill] = openPrefilled.mock.calls[0];
    act(() => prefill.onDone(false));

    expect(result.current.usedLines.size).toBe(0);
    expect(result.current.isOpen).toBe(true);
  });

  it('shows an error when the selected sale cannot be loaded', async () => {
    mockGet.mockRejectedValue({
      response: { data: { error: 'Venda não encontrada' } },
    });
    const openPrefilled = vi.fn();
    const { result } = renderHook(() =>
      useInfinitePayImport({ openPrefilled }),
    );

    await act(async () => {
      await result.current.selectSale(csvRow(), {
        saleId: 'missing',
        matchType: 'gross',
      });
    });

    expect(openPrefilled).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Venda não encontrada');
  });

  it('resets the state on close', async () => {
    mockPost.mockResolvedValue({ data: { rows: [csvRow()], ignoredCount: 0 } });
    const { result } = renderHook(() => useInfinitePayImport());

    await act(async () => {
      await result.current.importFile(new File(['x'], 'extrato.csv'));
    });
    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.rows).toEqual([]);
    expect(result.current.ignoredCount).toBe(0);
    expect(result.current.error).toBe('');
  });
});
