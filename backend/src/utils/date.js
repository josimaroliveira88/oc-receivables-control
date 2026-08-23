// Parse a YYYY-MM-DD string as a local (not UTC) calendar date, avoiding the
// timezone shift that `new Date('YYYY-MM-DD')` introduces for Brazilian users.
const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

module.exports = { parseLocalDate };
