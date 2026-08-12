export const MAX_DIGITS = 15;

export function onlyDigits(value) {
  return (value || '').replace(/\D/g, '').slice(0, MAX_DIGITS);
}

export function isDigitsOnly(value) {
  return /^\d+$/.test((value || '').trim());
}

export function isWhatsAppOutOfPattern(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return false;
  const digits = onlyDigits(trimmed);
  return digits.length < 10 || digits.length > 15;
}

export function maskWhatsApp(value) {
  const digits = onlyDigits(value);
  if (!digits) return '';
  let out = `+${digits.slice(0, 2)}`;
  const rest = digits.slice(2);
  if (!rest) return out;
  out += ` (${rest.slice(0, 2)}`;
  if (rest.length <= 2) return out;
  out += ')';
  const phone = rest.slice(2);
  if (phone.length <= 4) return `${out} ${phone}`;
  if (phone.length <= 8) return `${out} ${phone.slice(0, 4)}-${phone.slice(4)}`;
  return `${out} ${phone.slice(0, 5)}-${phone.slice(5)}`;
}

export function whatsAppLink(value) {
  const digits = onlyDigits(value || '');
  if (digits.length < 10 || digits.length > 15) return null;
  return `https://wa.me/${digits}`;
}
