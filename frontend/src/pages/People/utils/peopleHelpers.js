export const fieldClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors';

export const inputLabelClass =
  'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

export const instagramHref = (value) =>
  value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://${value}`;

export const emptyForm = () => ({
  name: '',
  commonGroups: '',
  whatsapp: '55',
  instagram: '',
  address: '',
  observacao: '',
  isVip: false,
  isDoterraMember: false,
  isSelf: false,
});

export const buildPayload = (form) => ({
  name: form.name.trim(),
  whatsapp: form.whatsapp.trim() ? form.whatsapp.trim() : null,
  commonGroups: form.commonGroups.trim() || null,
  instagram: form.instagram.trim() || null,
  address: form.address.trim() || null,
  observacao: form.observacao.trim() || null,
  isVip: form.isVip,
  isDoterraMember: form.isDoterraMember,
  isSelf: form.isSelf,
});

export const CLASSIFICATION_OPTIONS = [
  { value: '', label: 'Todas as classificações' },
  { value: 'vip', label: 'Somente VIP' },
  { value: 'member', label: 'Somente Membro doTERRA' },
  { value: 'vip_member', label: 'VIP + Membro doTERRA' },
  { value: 'none', label: 'Sem classificação' },
];

const SORTABLE_FIELDS = [
  'name',
  'commonGroups',
  'whatsapp',
  'instagram',
  'address',
  'isVip',
  'isDoterraMember',
];

const classificationMatch = (person, classification) => {
  switch (classification) {
    case 'vip':
      return person.isVip && !person.isDoterraMember;
    case 'member':
      return !person.isVip && person.isDoterraMember;
    case 'vip_member':
      return person.isVip && person.isDoterraMember;
    case 'none':
      return !person.isVip && !person.isDoterraMember;
    default:
      return true;
  }
};

export const filterAndSortPeople = (
  people,
  search,
  classification,
  sortBy,
  sortDir,
) => {
  const query = search.trim().toLowerCase();
  const field = SORTABLE_FIELDS.includes(sortBy) ? sortBy : 'name';
  const direction = sortDir === 'desc' ? -1 : 1;

  const result = people.filter((person) => {
    if (
      query &&
      !person.name.toLowerCase().includes(query) &&
      !String(person.whatsapp || '')
        .toLowerCase()
        .includes(query) &&
      !String(person.observacao || '')
        .toLowerCase()
        .includes(query)
    ) {
      return false;
    }
    if (!classificationMatch(person, classification)) return false;
    return true;
  });

  return [...result].sort((a, b) => {
    if (field === 'isVip' || field === 'isDoterraMember') {
      return (Number(a[field]) - Number(b[field])) * direction;
    }
    return (
      String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'pt-BR') *
      direction
    );
  });
};
