import { formatBRL, fromCents } from '../../../utils/money';

// Human labels for the removable reference kinds, matching the backend
// `DELETE /api/products/:id/references/:kind` contract.
export const REFERENCE_KIND_LABELS = {
  inventory: 'Estoque atual',
  'stock-movements': 'Movimentações de estoque',
  'exchange-lines': 'Trocas de estoque',
  'kit-component': 'Uso em kits',
};

export const BLOCKER_ORDER = [
  'inventory',
  'stock-movements',
  'exchange-lines',
  'kit-component',
];

// One-line summary of how much the product is used, shown under the header.
export const usageSummaryLine = (counts) => {
  if (!counts) return '';
  const parts = [
    counts.orderItems ? `${counts.orderItems} em pedidos/vendas` : null,
    counts.inventory ? 'estoque registrado' : null,
    counts.stockMovements ? `${counts.stockMovements} movimentações` : null,
    counts.stockExchangeLines ? `${counts.stockExchangeLines} trocas` : null,
    counts.kitComponents ? `${counts.kitComponents} kits` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' • ') : 'Sem referências registradas.';
};

// Impact alert for removing a single reference kind. Returns a plain string so
// it is easy to test; the modal renders it inside the ConfirmDialog.
export const referenceImpactMessage = (kind, snapshot) => {
  if (!snapshot) return '';
  const { references, counts } = snapshot;
  switch (kind) {
    case 'inventory': {
      const quantity = references.inventory?.quantity ?? 0;
      return `O estoque atual (${quantity} unidade(s)) será descartado e o registro de inventário do produto será removido.`;
    }
    case 'stock-movements':
      return `${counts.stockMovements} movimentação(ões) de estoque serão removidas permanentemente. O histórico do produto deixa de existir.`;
    case 'exchange-lines':
      return `${counts.stockExchangeLines} linha(s) de troca de estoque serão removidas.`;
    case 'kit-component': {
      const kits = (references.kitComponents || [])
        .map((kit) => kit.kitName)
        .join(', ');
      return `O produto deixará de fazer parte do(s) kit(s): ${kits}.`;
    }
    default:
      return '';
  }
};

// Impact alert for the final physical deletion. Enumerates every reference
// that will be removed so the user confirms with full knowledge.
export const hardDeleteImpactMessage = (snapshot) => {
  const product = snapshot?.product;
  const counts = snapshot?.counts;
  const orders = snapshot?.references?.affectedOrders || [];
  const label = product ? `${product.code} — ${product.name}` : 'este produto';

  const parts = [
    `O produto ${label} será apagado definitivamente do banco de dados.`,
  ];

  if (orders.length > 0) {
    const ordersText = orders
      .map((order) => {
        const kind = order.orderType === 'VENDA' ? 'Venda' : 'Pedido';
        return `${kind} ${order.orderNumber} ficará em ${formatBRL(
          fromCents(order.newTotalCents),
        )} (era ${formatBRL(fromCents(order.oldTotalCents))})`;
      })
      .join('; ');
    const totalItems = counts?.orderItems ?? orders.length;
    parts.push(
      `Os ${totalItems} item(ns) que usam este produto serão removidos dos pedidos/vendas e a transação financeira vinculada será recalculada: ${ordersText}.`,
    );
  }

  if (counts) {
    if (counts.inventory) {
      const quantity = snapshot.references?.inventory?.quantity ?? 0;
      parts.push(
        `O estoque atual (${quantity} unidade(s)) será descartado e o inventário removido.`,
      );
    }
    if (counts.stockMovements) {
      parts.push(
        `${counts.stockMovements} movimentação(ões) de estoque serão removidas.`,
      );
    }
    if (counts.stockExchangeLines) {
      parts.push(
        `${counts.stockExchangeLines} linha(s) de troca de estoque serão removidas.`,
      );
    }
    if (counts.kitComponents) {
      parts.push(
        `O produto será removido da composição de ${counts.kitComponents} kit(s).`,
      );
    }
    if (counts.kitComposition) {
      parts.push('A composição deste kit será removida.');
    }
  }

  parts.push('Esta ação não pode ser desfeita.');
  return parts.join(' ');
};

// Location label for an order/sale item reference.
export const orderItemLocationLabel = (item) =>
  item.orderType === 'VENDA'
    ? `Venda ${item.orderNumber}`
    : `Pedido ${item.orderNumber}`;

export const orderItemValueLabel = (item) =>
  formatBRL(Number(item.chargedValue) || 0);
