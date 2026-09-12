import {
  MOVEMENT_TYPE_CLASSES,
  STOCK_QUANTITY_CLASSES,
} from '../../../utils/badgeStyles';

export const MOVEMENT_TYPES = {
  ENTRADA: {
    label: 'Entrada',
    className: MOVEMENT_TYPE_CLASSES.ENTRADA,
  },
  SAIDA: {
    label: 'Saída',
    className: MOVEMENT_TYPE_CLASSES.SAIDA,
  },
  AJUSTE: {
    label: 'Ajuste',
    className: MOVEMENT_TYPE_CLASSES.AJUSTE,
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
    return STOCK_QUANTITY_CLASSES.missing;
  }
  if (value <= LOW_STOCK_THRESHOLD) {
    return STOCK_QUANTITY_CLASSES.low;
  }
  return STOCK_QUANTITY_CLASSES.ok;
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

export const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR');
};

export const todayLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const emptyMovementForm = (productId = '', type = 'ENTRADA') => ({
  productId,
  type,
  quantity: '',
  reason: '',
  effectiveDate: todayLocalDate(),
});

export const buildMovementPayload = (form) => {
  const payload = {
    productId: form.productId,
    type: form.type,
    quantity: Number.parseInt(form.quantity, 10),
  };
  const reason = (form.reason || '').trim();
  if (reason !== '') payload.reason = reason;
  const effectiveDate = (form.effectiveDate || '').trim();
  if (effectiveDate !== '') payload.effectiveDate = effectiveDate;
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
  const effectiveDate = (form.effectiveDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    return 'Data Efetiva é obrigatória';
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
