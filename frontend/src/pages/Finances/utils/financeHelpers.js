// Pure helpers for the finances module. No React here so labels, options and
// error extraction stay unit-testable and reusable across the page widgets.

export const CATEGORY_TYPE_OPTIONS = [
  { value: 'RECEITA', label: 'Receita' },
  { value: 'DESPESA', label: 'Despesa' },
];

// Normalizes an API error into a user-facing string. Zod validation issues
// arrive as an array of `{ message }`, while business errors arrive as a single
// string; anything else falls back to the provided generic message.
export const errorMessageFrom = (error, fallback) => {
  const data = error?.response?.data?.error;

  if (Array.isArray(data)) {
    const messages = data.map((issue) => issue?.message).filter(Boolean);
    if (messages.length > 0) return messages.join(' ');
  }

  if (typeof data === 'string' && data.trim() !== '') return data;

  return fallback;
};
