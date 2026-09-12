import { describe, it, expect } from 'vitest';
import {
  ORDER_STATUS_CLASSES,
  ORDER_STATUS_FALLBACK,
  PAYMENT_TYPE_CLASSES,
  PAYMENT_TYPE_FALLBACK,
  DELIVERY_CLASSES,
  PRODUCT_STATUS_CLASSES,
  MOVEMENT_TYPE_CLASSES,
  MOVEMENT_TYPE_FALLBACK,
  STOCK_QUANTITY_CLASSES,
  BOOL_BADGE_CLASSES,
} from '../src/utils/badgeStyles';

describe('badgeStyles', () => {
  it('covers every order status with soft background and saturated text tokens', () => {
    expect(Object.keys(ORDER_STATUS_CLASSES)).toEqual(
      expect.arrayContaining(['PENDENTE', 'PARCIAL', 'QUITADO', 'EQUIPE']),
    );
    for (const [status, cfg] of Object.entries(ORDER_STATUS_CLASSES)) {
      expect(cfg.className, status).toMatch(/^bg-\S+ text-\S+$/);
      expect(cfg.className).not.toMatch(/\bdark:/);
      expect(cfg.dot, status).toMatch(/^bg-\S+$/);
    }
  });

  it('maps order statuses to distinct support colors', () => {
    expect(ORDER_STATUS_CLASSES.PENDENTE.className).toBe(
      'bg-warning-soft text-warning-fg',
    );
    expect(ORDER_STATUS_CLASSES.PARCIAL.className).toBe(
      'bg-info-soft text-info-fg',
    );
    expect(ORDER_STATUS_CLASSES.QUITADO.className).toBe(
      'bg-success-soft text-success-fg',
    );
    expect(ORDER_STATUS_CLASSES.EQUIPE.className).toBe(
      'bg-mystic-soft text-mystic-fg',
    );
  });

  it('uses the dedicated payment badge tokens for each payment type', () => {
    expect(PAYMENT_TYPE_CLASSES.PIX).toBe('bg-badge-pix-bg text-badge-pix-fg');
    expect(PAYMENT_TYPE_CLASSES.BOLETO).toBe(
      'bg-badge-boleto-bg text-badge-boleto-fg',
    );
    expect(PAYMENT_TYPE_CLASSES.INFINITE_PAY).toBe(
      'bg-badge-infinitepay-bg text-badge-infinitepay-fg',
    );
    expect(PAYMENT_TYPE_CLASSES.CARTAO_CREDITO).toBe(
      'bg-mystic-soft text-mystic-fg',
    );
  });

  it('provides neutral fallbacks without raw palette colors', () => {
    expect(ORDER_STATUS_FALLBACK.className).toBe('bg-base text-ink-soft');
    expect(PAYMENT_TYPE_FALLBACK).toBe('bg-base text-ink-soft');
    expect(MOVEMENT_TYPE_FALLBACK).toBe('bg-base text-ink-soft');
  });

  it('maps delivery, product, movement, stock and boolean indicators', () => {
    expect(DELIVERY_CLASSES.delivered.className).toBe(
      'bg-success-soft text-success-fg',
    );
    expect(DELIVERY_CLASSES.pending.className).toBe(
      'bg-warning-soft text-warning-fg',
    );
    expect(PRODUCT_STATUS_CLASSES).toEqual({
      ATIVO: 'bg-success-soft text-success-fg',
      INDISPONIVEL: 'bg-warning-soft text-warning-fg',
      INATIVO: 'bg-base text-ink-soft',
    });
    expect(MOVEMENT_TYPE_CLASSES).toEqual({
      ENTRADA: 'bg-success-soft text-success-fg',
      SAIDA: 'bg-danger-soft text-danger-fg',
      AJUSTE: 'bg-info-soft text-info-fg',
    });
    expect(STOCK_QUANTITY_CLASSES).toEqual({
      missing: 'bg-danger-soft text-danger-fg',
      low: 'bg-warning-soft text-warning-fg',
      ok: 'bg-success-soft text-success-fg',
    });
    expect(BOOL_BADGE_CLASSES).toEqual({
      true: 'bg-success-soft text-success-fg',
      false: 'bg-base text-ink-soft',
    });
  });

  it('never references a raw color palette or hardcoded hex', () => {
    const all = [
      ...Object.values(ORDER_STATUS_CLASSES).flatMap((c) => [
        c.className,
        c.dot,
      ]),
      ...Object.values(PAYMENT_TYPE_CLASSES),
      ...Object.values(DELIVERY_CLASSES).flatMap((c) => [c.className, c.dot]),
      ...Object.values(PRODUCT_STATUS_CLASSES),
      ...Object.values(MOVEMENT_TYPE_CLASSES),
      ...Object.values(STOCK_QUANTITY_CLASSES),
      ...Object.values(BOOL_BADGE_CLASSES),
    ];
    for (const cls of all) {
      expect(cls).not.toMatch(
        /\b(red|green|emerald|amber|blue|indigo|sky|violet|rose)-\d/,
      );
      expect(cls).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });
});
