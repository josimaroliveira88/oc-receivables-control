import { describe, it, expect } from 'vitest';
import {
  TRANSACTION_TYPE_OPTIONS,
  ORIGIN_FILTER_OPTIONS,
  TYPE_BADGE_CLASSES,
  ORIGIN_LABELS,
  transactionTypeLabel,
  originLabel,
  formatSignedBRL,
  buildTransactionParams,
  describeTransactionFilters,
  hasActiveTransactionFilters,
  buildSettlementPayload,
  findInfinitePaySales,
  summarizeInfinitePaySale,
  summarizeSaleSettlements,
} from '../src/pages/Finances/utils/financeHelpers';

describe('financeHelpers labels', () => {
  it('exposes the type options', () => {
    expect(TRANSACTION_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      '',
      'RECEITA',
      'DESPESA',
    ]);
  });

  it('exposes the origin filter options', () => {
    expect(ORIGIN_FILTER_OPTIONS.map((o) => o.value)).toEqual([
      '',
      'VENDA',
      'RESGATE_INFINITEPAY',
      'PEDIDO_DOTERRA',
      'VENDA_ADICIONAL',
      'MANUAL',
      'CARTAO_CREDITO',
    ]);
  });

  it('maps transaction types to friendly labels', () => {
    expect(transactionTypeLabel('RECEITA')).toBe('Receita');
    expect(transactionTypeLabel('DESPESA')).toBe('Despesa');
    expect(transactionTypeLabel(undefined)).toBe('—');
  });

  it('maps origins to friendly labels', () => {
    expect(originLabel('VENDA')).toBe('Venda');
    expect(originLabel('RESGATE_INFINITEPAY')).toBe('Resgate InfinitePay');
    expect(originLabel('PEDIDO_DOTERRA')).toBe('Pedido dōTERRA');
    expect(originLabel('VENDA_ADICIONAL')).toBe('Adicional de venda');
    expect(originLabel('MANUAL')).toBe('Manual');
    expect(originLabel('CARTAO_CREDITO')).toBe('Cartão de crédito');
    expect(originLabel('NOPE')).toBe('—');
  });

  it('provides the origin label map', () => {
    expect(ORIGIN_LABELS.MANUAL).toBe('Manual');
    expect(ORIGIN_LABELS.VENDA_ADICIONAL).toBe('Adicional de venda');
  });

  it('maps types to badge classes', () => {
    expect(TYPE_BADGE_CLASSES.RECEITA).toContain('success');
    expect(TYPE_BADGE_CLASSES.DESPESA).toContain('danger');
  });
});

describe('formatSignedBRL', () => {
  it('adds a plus sign to income and a minus sign to expenses', () => {
    expect(formatSignedBRL('100.00', 'RECEITA')).toMatch(/^\+R\$\s*100,00$/);
    expect(formatSignedBRL('100.00', 'DESPESA')).toMatch(/^-R\$\s*100,00$/);
  });
});

describe('buildTransactionParams', () => {
  it('returns an empty object when no filter is set', () => {
    expect(
      buildTransactionParams({
        type: '',
        origin: '',
        categoryId: '',
        from: '',
        to: '',
        search: '',
      }),
    ).toEqual({});
  });

  it('includes only the committed filters', () => {
    expect(
      buildTransactionParams({
        type: 'RECEITA',
        origin: 'VENDA',
        categoryId: 'cat-1',
        from: '2026-01-01',
        to: '2026-01-31',
        search: 'bônus',
      }),
    ).toEqual({
      type: 'RECEITA',
      origin: 'VENDA',
      categoryId: 'cat-1',
      from: '2026-01-01',
      to: '2026-01-31',
      q: 'bônus',
    });
  });
});

describe('filter awareness helpers', () => {
  it('detects active filters', () => {
    expect(hasActiveTransactionFilters({ type: '', search: '' })).toBe(false);
    expect(hasActiveTransactionFilters({ type: 'RECEITA' })).toBe(true);
    expect(hasActiveTransactionFilters({ search: 'x' })).toBe(true);
  });

  it('describes the active filters', () => {
    expect(describeTransactionFilters({ type: 'RECEITA' })).toContain(
      'Receita',
    );
    expect(describeTransactionFilters({ search: 'bônus' })).toContain('bônus');
  });
});

describe('buildSettlementPayload', () => {
  it('converts the masked amount to a number', () => {
    expect(
      buildSettlementPayload({
        amount: '613.12',
        transactionDate: '2026-09-19',
        notes: ' parcial ',
      }),
    ).toEqual({
      amount: 613.12,
      transactionDate: '2026-09-19',
      notes: 'parcial',
    });
  });

  it('sends null notes when empty', () => {
    expect(
      buildSettlementPayload({
        amount: '10',
        transactionDate: '2026-09-19',
        notes: '',
      }),
    ).toEqual({
      amount: 10,
      transactionDate: '2026-09-19',
      notes: null,
    });
  });
});

const saleWithPayments = (payments) => ({
  id: 's1',
  orderNumber: 'V-0001',
  payments,
});

describe('findInfinitePaySales', () => {
  it('keeps only sales with at least one InfinitePay payment', () => {
    const sales = [
      saleWithPayments([{ paymentType: 'PIX' }]),
      saleWithPayments([{ paymentType: 'INFINITE_PAY' }]),
      saleWithPayments([]),
    ];
    expect(findInfinitePaySales(sales).map((s) => s.id)).toEqual(['s1']);
  });
});

describe('summarizeSaleSettlements', () => {
  const sale = {
    id: 's1',
    orderNumber: 'V-0001',
    payments: [
      { paymentType: 'INFINITE_PAY', amount: '100.00' },
      { paymentType: 'INFINITE_PAY', amount: '20.00' },
      { paymentType: 'PIX', amount: '50.00' },
    ],
  };

  it('sums the gross InfinitePay charged amount in cents', () => {
    const summary = summarizeInfinitePaySale(sale);
    expect(summary.infinitePayCents).toBe(12000);
    expect(summary.hasInfinitePay).toBe(true);
  });

  it('subtracts linked redemptions from the redeemable total', () => {
    const summary = summarizeInfinitePaySale(sale, [
      { origin: 'RESGATE_INFINITEPAY', orderId: 's1', amount: '30.00' },
    ]);
    expect(summary.settledCents).toBe(3000);
    expect(summary.pendingCents).toBe(9000);
  });

  it('compares the linked redemptions of a sale', () => {
    const transactions = [
      {
        origin: 'RESGATE_INFINITEPAY',
        orderId: 's1',
        amount: '40.00',
      },
      { origin: 'VENDA', orderId: 's1', amount: '999.00' },
      { origin: 'RESGATE_INFINITEPAY', orderId: 'other', amount: '5.00' },
    ];
    const linked = summarizeSaleSettlements(transactions, 's1');
    expect(linked.settledCents).toBe(4000);
    expect(linked.count).toBe(1);
  });
});
