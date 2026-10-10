// Pure helpers for the stock-exchange dialog. No React or fetch — they only
// transform the local form state so the page hook can wire them to the API.
// Money is kept as integer cents at the edges (`unitValueCents`); inside the
// helpers we use cents to avoid the floating-point rule from AGENTS.md.
import { toCents } from '../../../utils/money';
import { todayLocalDate } from './stockHelpers';

export const STOCK_EXCHANGE_LINE_MAX_OBSERVATION = 1000;

let lineUidSeq = 0;

const newLineUid = () => {
  lineUidSeq += 1;
  return `line-${Date.now()}-${lineUidSeq}`;
};

export const emptyExchangeLine = () => ({
  uid: newLineUid(),
  productId: '',
  quantity: '',
  unitValue: '',
});

export const emptyExchangeForm = () => ({
  personId: '',
  effectiveDate: todayLocalDate(),
  observation: '',
  outgoingLines: [],
  incomingLines: [],
});

// Resolve the unit value in cents for a single line, in the order documented
// to the user: explicit value → catalog regularPrice → 0 (line contributes
// nothing to the difference preview).
const resolveLineUnitCents = (line, productPriceMap) => {
  if (
    line.unitValue !== '' &&
    line.unitValue !== null &&
    line.unitValue !== undefined
  ) {
    const parsed = toCents(parseFloat(line.unitValue));
    if (!Number.isNaN(parsed)) return parsed;
  }
  const product = productPriceMap[line.productId];
  if (!product) return 0;
  const raw = product.regularPrice;
  if (raw === null || raw === undefined || raw === '') return 0;
  return toCents(parseFloat(raw));
};

const resolveLineQuantity = (line) => {
  if (line.quantity === '' || line.quantity === null) return 0;
  const parsed = parseInt(line.quantity, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
};

const lineSubtotalCents = (line, productPriceMap) =>
  resolveLineQuantity(line) * resolveLineUnitCents(line, productPriceMap);

export const exchangeTotals = (form, productPriceMap) => {
  const outgoingCents = form.outgoingLines.reduce(
    (acc, line) => acc + lineSubtotalCents(line, productPriceMap),
    0,
  );
  const incomingCents = form.incomingLines.reduce(
    (acc, line) => acc + lineSubtotalCents(line, productPriceMap),
    0,
  );
  return {
    outgoingCents,
    incomingCents,
    diffCents: incomingCents - outgoingCents,
  };
};

const validateLine = (line, side) => {
  if (!line.productId) return `Selecione o produto ${side}`;
  if (line.quantity === '' || line.quantity === null) {
    return 'Quantidade é obrigatória';
  }
  const qty = parseInt(line.quantity, 10);
  if (Number.isNaN(qty) || qty <= 0) {
    return 'Quantidade deve ser maior que zero';
  }
  if (line.unitValue !== '' && line.unitValue !== null) {
    const v = parseFloat(line.unitValue);
    if (Number.isNaN(v) || v < 0) {
      return 'Valor unitário deve ser maior ou igual a zero';
    }
  }
  return null;
};

export const validateExchange = (form) => {
  if (!form.personId) return 'Selecione a pessoa da troca';
  if (form.outgoingLines.length === 0) {
    return 'Adicione ao menos um produto que sai';
  }
  if (form.incomingLines.length === 0) {
    return 'Adicione ao menos um produto que entra';
  }
  for (const line of form.outgoingLines) {
    const err = validateLine(line, 'que sai');
    if (err) return err;
  }
  for (const line of form.incomingLines) {
    const err = validateLine(line, 'que entra');
    if (err) return err;
  }
  if (
    form.observation &&
    form.observation.length > STOCK_EXCHANGE_LINE_MAX_OBSERVATION
  ) {
    return `A observação deve ter no máximo ${STOCK_EXCHANGE_LINE_MAX_OBSERVATION} caracteres`;
  }
  return null;
};

const buildLinePayload = (line) => {
  const payload = {
    productId: line.productId,
    quantity: parseInt(line.quantity, 10),
  };
  if (line.unitValue !== '' && line.unitValue !== null) {
    payload.unitValueCents = toCents(parseFloat(line.unitValue));
  }
  return payload;
};

export const buildExchangePayload = (form) => {
  const payload = {
    personId: form.personId,
    effectiveDate: form.effectiveDate,
    outgoingLines: form.outgoingLines.map(buildLinePayload),
    incomingLines: form.incomingLines.map(buildLinePayload),
  };
  const observation = (form.observation || '').trim();
  if (observation !== '') payload.observation = observation;
  return payload;
};
