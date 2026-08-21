export const emptyItem = () => ({
  id: Date.now(),
  description: '',
  chargedValue: '',
  personId: '',
  productId: '',
  productName: '',
  productCode: '',
  memberPrice: '',
  pv: '',
  details: '',
});

// Sentinel value used by the person <select> to represent the logged-in user
// when they have not yet been registered as a Person.
export const SELF_PERSON_ID = '__SELF__';

// Returns the self person (the logged-in user's own Person record), if any.
export const findSelfPerson = (people) =>
  (people || []).find((person) => person.isSelf) || null;

// Builds the option label for a person in the order item select.
export const personSelectLabel = (person) =>
  person.isSelf ? `${person.name} (Você)` : person.name;

export const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const trackingUrl = (orderNumber) =>
  `https://status.ondeestameupedido.com/tracking/22747/${encodeURIComponent(orderNumber)}/`;

export const paymentTypeLabel = (type) => {
  const map = {
    PIX: 'PIX',
    BOLETO: 'Boleto',
    CARTAO_CREDITO: 'Cartão de Crédito',
  };
  return map[type] || type;
};

export const itemPayload = (item) => ({
  description: item.description.trim() || null,
  chargedValue:
    item.chargedValue === '' || item.chargedValue == null
      ? 0
      : parseFloat(item.chargedValue),
  personId: item.personId,
  productId: item.productId || null,
  memberPrice:
    item.memberPrice !== '' && item.memberPrice != null
      ? parseFloat(item.memberPrice)
      : null,
  pv: item.pv !== '' && item.pv != null ? parseFloat(item.pv) : null,
  details: item.details.trim() || null,
});

export const editItemFromApi = (item) => ({
  id: item.id,
  description: item.description || '',
  chargedValue:
    item.chargedValue != null ? parseFloat(item.chargedValue).toString() : '',
  personId: item.personId || '',
  productId: item.productId || '',
  productName: item.product ? item.product.name : '',
  productCode: item.product ? item.product.code : '',
  memberPrice:
    item.memberPrice != null ? parseFloat(item.memberPrice).toString() : '',
  pv: item.pv != null ? parseFloat(item.pv).toString() : '',
  details: item.details || '',
});
