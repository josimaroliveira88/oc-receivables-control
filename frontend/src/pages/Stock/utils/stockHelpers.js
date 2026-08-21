export const MOVEMENT_TYPES = {
  ENTRADA: {
    label: 'Entrada',
    className:
      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  },
  SAIDA: {
    label: 'Saída',
    className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  },
  AJUSTE: {
    label: 'Ajuste',
    className:
      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  },
};

export const MOVEMENT_TYPE_OPTIONS = [
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'SAIDA', label: 'Saída' },
  { value: 'AJUSTE', label: 'Ajuste' },
];

export const LOW_STOCK_THRESHOLD = 5;

export const stockBadgeClass = (quantity) => {
  const value = Number(quantity ?? 0);
  if (value <= 0) {
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  }
  if (value <= LOW_STOCK_THRESHOLD) {
    return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
  }
  return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
};

export const formatQuantity = (n) => String(Number(n ?? 0));

export const formatSignedQuantity = (n) => {
  const value = Number(n ?? 0);
  if (value > 0) return `+${value}`;
  return String(value);
};

export const formatDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR');
};

export const emptyMovementForm = (productId = '', type = 'ENTRADA') => ({
  productId,
  type,
  quantity: '',
  reason: '',
});

export const buildMovementPayload = (form) => {
  const payload = {
    productId: form.productId,
    type: form.type,
    quantity: Number.parseInt(form.quantity, 10),
  };
  const reason = (form.reason || '').trim();
  if (reason !== '') payload.reason = reason;
  return payload;
};

export const validateMovement = (form) => {
  if (!form.productId) {
    return 'Produto é obrigatório';
  }
  if (form.quantity === '' || form.quantity === null) {
    return 'Quantidade é obrigatória';
  }
  const qty = Number.parseInt(form.quantity, 10);
  if (Number.isNaN(qty)) {
    return 'Quantidade é obrigatória';
  }
  if (form.type === 'ENTRADA' || form.type === 'SAIDA') {
    if (qty <= 0) return 'Quantidade deve ser maior que zero';
  } else if (form.type === 'AJUSTE') {
    if (qty < 0) return 'Quantidade deve ser maior ou igual a zero';
  }
  const reason = (form.reason || '').trim();
  if (reason.length > 255) {
    return 'Motivo deve ter no máximo 255 caracteres';
  }
  return null;
};

const SORTABLE_FIELDS = ['code', 'name', 'size', 'quantity'];

export const filterAndSortStock = (inventory, search, sortBy, sortDir) => {
  const query = search.trim().toLowerCase();
  const field = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'name';
  const direction = sortDir === 'desc' ? -1 : 1;

  const result = inventory.filter((item) => {
    if (
      query &&
      !item.code.toLowerCase().includes(query) &&
      !item.name.toLowerCase().includes(query)
    ) {
      return false;
    }
    return true;
  });

  return [...result].sort((a, b) => {
    if (field === 'quantity') {
      return (Number(a[field]) - Number(b[field])) * direction;
    }
    return (
      String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'pt-BR') *
      direction
    );
  });
};
