import { describe, it, expect } from 'vitest';
import {
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
});
