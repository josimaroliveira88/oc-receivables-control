import { describe, it, expect } from 'vitest';
import {
  formatBillStatus,
  splitTotalIntoInstallments,
  effectiveDateForInstallment,
  formatInstallmentBadge,
  originLabel,
  summarizeBills,
  buildBillPayload,
  emptyBillForm,
  billToForm,
} from '../src/pages/CreditCards/utils/creditCardHelpers';

const installment = (id, number, total, isEffective) => ({
  id,
  type: 'DESPESA',
  origin: 'CARTAO_CREDITO',
  amount: '100.00',
  description: 'Compra',
  transactionDate: '2026-09-15T00:00:00.000Z',
  isEffective,
  effectiveDate: isEffective ? '2026-09-15T00:00:00.000Z' : null,
  installmentNumber: number,
  installmentsTotal: total,
});

const bill = (transactions) => ({
  id: 'bill-1',
  description: 'Compra',
  totalCents: 30000,
  installments: 3,
  firstInstallmentAt: '2026-09-15T00:00:00.000Z',
  transactions,
});

describe('formatBillStatus', () => {
  it('returns Paga when every installment is effective', () => {
    expect(
      formatBillStatus(
        bill([
          installment('a', 1, 3, true),
          installment('b', 2, 3, true),
          installment('c', 3, 3, true),
        ]),
      ),
    ).toBe('Paga');
  });

  it('returns Parcial when only some installments are effective', () => {
    expect(
      formatBillStatus(
        bill([
          installment('a', 1, 3, true),
          installment('b', 2, 3, false),
          installment('c', 3, 3, false),
        ]),
      ),
    ).toBe('Parcial');
  });

  it('returns Aberta when no installment is effective', () => {
    expect(
      formatBillStatus(
        bill([
          installment('a', 1, 3, false),
          installment('b', 2, 3, false),
          installment('c', 3, 3, false),
        ]),
      ),
    ).toBe('Aberta');
  });
});

describe('splitTotalIntoInstallments', () => {
  it('splits an evenly divisible total into equal cents', () => {
    expect(splitTotalIntoInstallments(43864, 4)).toEqual([
      10966, 10966, 10966, 10966,
    ]);
  });

  it('lets the first installment absorb the rounding remainder', () => {
    expect(splitTotalIntoInstallments(43865, 4)).toEqual([
      10967, 10966, 10966, 10966,
    ]);
  });
});

describe('effectiveDateForInstallment', () => {
  it('adds one month per installment number', () => {
    expect(effectiveDateForInstallment('2026-09-15', 1)).toBe('2026-09-15');
    expect(effectiveDateForInstallment('2026-09-15', 2)).toBe('2026-10-15');
    expect(effectiveDateForInstallment('2026-09-15', 4)).toBe('2026-12-15');
  });

  it('clamps to the last day of a shorter target month', () => {
    expect(effectiveDateForInstallment('2026-01-31', 2)).toBe('2026-02-28');
    expect(effectiveDateForInstallment('2026-01-31', 4)).toBe('2026-04-30');
  });

  it('returns an empty string without a reference date', () => {
    expect(effectiveDateForInstallment('', 1)).toBe('');
    expect(effectiveDateForInstallment('2026-09-15', 0)).toBe('');
  });
});

describe('formatInstallmentBadge', () => {
  it('renders the installment number over the total', () => {
    expect(formatInstallmentBadge(1, 12)).toBe('1/12');
  });

  it('returns an em dash when there is no installment', () => {
    expect(formatInstallmentBadge(0, 0)).toBe('—');
    expect(formatInstallmentBadge(null, null)).toBe('—');
  });
});

describe('originLabel', () => {
  it('labels the credit card origin', () => {
    expect(originLabel('CARTAO_CREDITO')).toBe('Cartão de crédito');
  });
});

describe('summarizeBills', () => {
  it('totals the bills, the pending installments and the month paid', () => {
    const now = new Date(2026, 8, 20);
    const summary = summarizeBills(
      [
        bill([
          installment('a', 1, 3, true),
          installment('b', 2, 3, false),
          installment('c', 3, 3, false),
        ]),
      ],
      now,
    );
    expect(summary.totalCents).toBe(30000);
    expect(summary.pendingCents).toBe(20000);
    expect(summary.paidThisMonthCents).toBe(10000);
  });
});

describe('bill form helpers', () => {
  it('builds a normalized payload from the form values', () => {
    expect(
      buildBillPayload({
        ...emptyBillForm(),
        description: '  Compra de teste ',
        totalAmount: '438.64',
        installments: 4,
        firstInstallmentAt: '2026-09-15',
      }),
    ).toEqual({
      description: 'Compra de teste',
      totalAmount: 438.64,
      installments: 4,
      firstInstallmentAt: '2026-09-15',
      brand: null,
      notes: null,
    });
  });

  it('pre-fills the form from an existing bill', () => {
    const form = billToForm({
      id: 'bill-1',
      description: 'Compra',
      totalCents: 43864,
      installments: 4,
      firstInstallmentAt: '2026-09-15T00:00:00.000Z',
      brand: 'Visa',
      notes: 'nota',
    });
    expect(form.id).toBe('bill-1');
    expect(form.totalAmount).toBe('438.64');
    expect(form.installments).toBe(4);
    expect(form.firstInstallmentAt).toBe('2026-09-15');
    expect(form.brand).toBe('Visa');
    expect(form.notes).toBe('nota');
  });
});
