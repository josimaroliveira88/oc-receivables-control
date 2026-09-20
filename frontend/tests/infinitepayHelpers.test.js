import { describe, it, expect } from 'vitest';
import {
  buildEditPaymentPrefill,
  buildPaymentPrefill,
  formatStatementCents,
  matchTypeColumnLabel,
  matchTypeLabel,
} from '../src/pages/Sales/utils/infinitepayHelpers';

describe('infinitepayHelpers', () => {
  describe('matchTypeLabel', () => {
    it('labels gross matches as the charged value', () => {
      expect(matchTypeLabel('gross')).toBe('Igual ao valor');
    });

    it('labels net matches as the received value', () => {
      expect(matchTypeLabel('net')).toBe('Igual ao líquido');
    });

    it('defaults to gross for unknown values', () => {
      expect(matchTypeLabel(undefined)).toBe('Igual ao valor');
    });
  });

  describe('matchTypeColumnLabel', () => {
    it('returns the matching column name', () => {
      expect(matchTypeColumnLabel('gross')).toBe('Valor');
      expect(matchTypeColumnLabel('net')).toBe('Líquido');
    });
  });

  describe('formatStatementCents', () => {
    it('formats integer cents as BRL', () => {
      expect(formatStatementCents(23402)).toMatch(/234,02/);
    });
  });

  describe('buildPaymentPrefill', () => {
    const row = {
      valorCents: 23402,
      liquidoCents: 22001,
      date: '2026-09-16',
      nsu: 'abc-123',
    };

    it('fills the gross charged and net received amounts', () => {
      const prefill = buildPaymentPrefill(row, { matchType: 'gross' });
      expect(prefill.paymentType).toBe('INFINITE_PAY');
      expect(prefill.paymentAmount).toBe('234.02');
      expect(prefill.paymentNetAmount).toBe('220.01');
      expect(prefill.paymentDate).toBe('2026-09-16');
      expect(prefill.paymentNotes).toContain('abc-123');
    });

    it('does not pass the fee to the client on a gross match', () => {
      expect(
        buildPaymentPrefill(row, { matchType: 'gross' })
          .passesGatewayFeeToClient,
      ).toBe(false);
    });

    it('passes the fee to the client on a net match', () => {
      expect(
        buildPaymentPrefill(row, { matchType: 'net' }).passesGatewayFeeToClient,
      ).toBe(true);
    });
  });

  describe('buildEditPaymentPrefill', () => {
    const row = {
      valorCents: 64000,
      liquidoCents: 61312,
      date: '2026-09-13',
      nsu: 'YEYXH9',
    };

    it('derives the CSV values and keeps the payment on InfinitePay', () => {
      const prefill = buildEditPaymentPrefill(
        row,
        { matchType: 'gross' },
        { amount: '613.12', netAmount: null, notes: null },
      );
      expect(prefill.paymentAmount).toBe('640.00');
      expect(prefill.paymentNetAmount).toBe('613.12');
      expect(prefill.paymentDate).toBe('2026-09-13');
      expect(prefill.paymentType).toBe('INFINITE_PAY');
      expect(prefill.passesGatewayFeeToClient).toBe(false);
    });

    it('passes the fee to the client on a net match', () => {
      const prefill = buildEditPaymentPrefill(
        row,
        { matchType: 'net' },
        { amount: '613.12', netAmount: null, notes: null },
      );
      expect(prefill.passesGatewayFeeToClient).toBe(true);
    });

    it('appends the NSU to the existing notes', () => {
      const prefill = buildEditPaymentPrefill(
        row,
        { matchType: 'gross' },
        { amount: '613.12', netAmount: null, notes: 'Pix recebido' },
      );
      expect(prefill.paymentNotes).toBe(
        'Pix recebido · InfinitePay · NSU YEYXH9',
      );
    });

    it('uses the NSU note alone when the payment has no notes', () => {
      const prefill = buildEditPaymentPrefill(
        row,
        { matchType: 'gross' },
        { amount: '613.12', netAmount: null, notes: '   ' },
      );
      expect(prefill.paymentNotes).toBe('InfinitePay · NSU YEYXH9');
    });
  });
});
