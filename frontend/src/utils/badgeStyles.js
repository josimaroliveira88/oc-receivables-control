// Central color mapping for status/type badges.
// Uses semantic design tokens (see src/index.css) so badge colors adapt to
// light/dark mode without per-component dark: variants. Class strings are
// static literals so Tailwind can detect them during the content scan.

export const ORDER_STATUS_CLASSES = {
  PENDENTE: {
    className: 'bg-warning-soft text-warning-fg',
    dot: 'bg-warning-fg',
  },
  PARCIAL: {
    className: 'bg-info-soft text-info-fg',
    dot: 'bg-info-fg',
  },
  QUITADO: {
    className: 'bg-success-soft text-success-fg',
    dot: 'bg-success-fg',
  },
  EQUIPE: {
    className: 'bg-mystic-soft text-mystic-fg',
    dot: 'bg-mystic-fg',
  },
};

export const ORDER_STATUS_FALLBACK = {
  className: 'bg-base text-ink-soft',
  dot: 'bg-ink-faint',
};

export const PAYMENT_TYPE_CLASSES = {
  PIX: 'bg-badge-pix-bg text-badge-pix-fg',
  BOLETO: 'bg-badge-boleto-bg text-badge-boleto-fg',
  CARTAO_CREDITO: 'bg-mystic-soft text-mystic-fg',
  INFINITE_PAY: 'bg-badge-infinitepay-bg text-badge-infinitepay-fg',
  DINHEIRO: 'bg-badge-dinheiro-bg text-badge-dinheiro-fg',
};

export const PAYMENT_TYPE_FALLBACK = 'bg-base text-ink-soft';

// InfinitePay import: how a suggestion matched the statement row (gross value
// charged vs net value received).
export const INFINITEPAY_MATCH_CLASSES = {
  gross: 'bg-info-soft text-info-fg',
  net: 'bg-mystic-soft text-mystic-fg',
};

export const ORDER_ORIGIN_CLASSES = {
  user: 'bg-base text-ink-soft',
  team: 'bg-mystic-soft text-mystic-fg',
};

export const DELIVERY_CLASSES = {
  delivered: {
    className: 'bg-success-soft text-success-fg',
    dot: 'bg-success-fg',
  },
  pending: {
    className: 'bg-warning-soft text-warning-fg',
    dot: 'bg-warning-fg',
  },
};

export const PRODUCT_STATUS_CLASSES = {
  ATIVO: 'bg-success-soft text-success-fg',
  INDISPONIVEL: 'bg-warning-soft text-warning-fg',
  INATIVO: 'bg-base text-ink-soft',
};

export const MOVEMENT_TYPE_CLASSES = {
  ENTRADA: 'bg-success-soft text-success-fg',
  SAIDA: 'bg-danger-soft text-danger-fg',
  AJUSTE: 'bg-info-soft text-info-fg',
};

export const MOVEMENT_TYPE_FALLBACK = 'bg-base text-ink-soft';

export const STOCK_QUANTITY_CLASSES = {
  missing: 'bg-danger-soft text-danger-fg',
  low: 'bg-warning-soft text-warning-fg',
  ok: 'bg-success-soft text-success-fg',
};

export const BOOL_BADGE_CLASSES = {
  true: 'bg-success-soft text-success-fg',
  false: 'bg-base text-ink-soft',
};

export const CATEGORY_BADGE_CLASSES = {
  default: 'bg-info-soft text-info-fg',
  inactive: 'bg-base text-ink-soft',
};

export const FINANCIAL_TRANSACTION_TYPE_CLASSES = {
  RECEITA: 'bg-success-soft text-success-fg',
  DESPESA: 'bg-danger-soft text-danger-fg',
};

export const FINANCIAL_TRANSACTION_TYPE_FALLBACK = 'bg-base text-ink-soft';
