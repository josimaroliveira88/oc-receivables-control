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
  isVip: false,
  isDoterraMember: false,
});

export const buildPayload = (form) => ({
  name: form.name.trim(),
  whatsapp: form.whatsapp.trim() ? form.whatsapp.trim() : null,
  commonGroups: form.commonGroups.trim() || null,
  instagram: form.instagram.trim() || null,
  address: form.address.trim() || null,
  isVip: form.isVip,
  isDoterraMember: form.isDoterraMember,
});
