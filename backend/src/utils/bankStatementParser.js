// Parser for the InfinitePay bank-account statement export (the "extrato" CSV
// the user downloads from the bank: 6 columns, Pix sent plus the sale deposits
// that composed each redemption). It is a different layout from the InfinitePay
// sales report parsed by `csvParser.js`, so it gets its own reader.
//
// The statement is newest-first: each redemption (`Pix` / `Enviado`, negative)
// is followed by the `Depósito de vendas` rows that composed it. The parser
// pairs every rescue with the following contiguous deposits whose sum matches
// the redeemed amount (2-cent tolerance), which is what the UI uses to suggest
// the originating sales.
import { parseCsvRecords } from './csvParser.js';

// Canonical bank statement header. Diverging from it means the file is not the
// expected export, so it is rejected instead of guessed at.
const BANK_STATEMENT_HEADER = [
  'Data',
  'Hora',
  'Tipo de transação',
  'Nome',
  'Detalhe',
  'Valor',
];

const RESCUE_TYPE = 'Pix';
const RESCUE_DETAIL = 'Enviado';
const DEPOSIT_TYPE = 'Depósito de vendas';

// Same tolerance the sales-import matcher uses.
const MATCH_TOLERANCE_CENTS = 2;

// Domain error thrown when the statement is not in the expected layout. `line`
// (1-based, including the header) points the user at the offending row.
class BankStatementCsvError extends Error {
  constructor(message, { line } = {}) {
    super(message);
    this.name = 'BankStatementCsvError';
    if (line !== undefined) this.line = line;
  }
}

// Parses a signed Brazilian monetary string with the currency prefix the
// statement uses ('-R$ 220,01' / '+R$ 334,15') into signed integer cents.
// Returns null when the value is not a valid amount.
function parseSignedBrlCents(raw) {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/\s/g, '');
  if (cleaned === '') return null;

  let sign = 1;
  let rest = cleaned;
  if (rest.startsWith('-')) {
    sign = -1;
    rest = rest.slice(1);
  } else if (rest.startsWith('+')) {
    rest = rest.slice(1);
  }
  rest = rest.replace(/R\$/i, '');

  const normalized = rest.includes(',')
    ? rest.replace(/\./g, '').replace(',', '.')
    : rest;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return sign * Math.round(parseFloat(normalized) * 100);
}

// Validates a 'YYYY-MM-DD' calendar date without timezone shifts. Returns the
// original string or null.
function parseStatementDate(raw) {
  const value = String(raw ?? '').trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return value;
}

// Validates 'HH:MM' or 'HH:MM:SS' and returns 'HH:MM'.
function parseStatementTime(raw) {
  const value = String(raw ?? '').trim();
  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, hour, minute] = match;
  if (Number(hour) > 23 || Number(minute) > 59) return null;
  return `${hour}:${minute}`;
}

const classify = (type, detail) => {
  if (type === RESCUE_TYPE && detail === RESCUE_DETAIL) return 'rescue';
  if (type === DEPOSIT_TYPE) return 'deposit';
  return 'other';
};

const depositFrom = (row) => ({
  line: row.line,
  date: row.date,
  time: row.time,
  amountCents: row.amountCents,
  name: row.name,
});

// Parses the statement into rescues paired with their source deposits. Throws
// `BankStatementCsvError` when the header diverges or any row is malformed.
function parseBankStatement(csvText) {
  const records = parseCsvRecords(String(csvText ?? '').replace(/^\uFEFF/, ''));

  if (records.length === 0) {
    throw new BankStatementCsvError('O arquivo CSV está vazio.');
  }

  const header = records[0].fields.map((column) => column.trim());
  const headerMatches =
    header.length === BANK_STATEMENT_HEADER.length &&
    BANK_STATEMENT_HEADER.every((name, index) => header[index] === name);
  if (!headerMatches) {
    throw new BankStatementCsvError(
      'Cabeçalho fora do padrão do extrato bancário do InfinitePay. Exporte o extrato novamente.',
    );
  }

  const rows = [];
  for (let index = 1; index < records.length; index += 1) {
    const { fields: columns, line } = records[index];

    if (columns.length !== BANK_STATEMENT_HEADER.length) {
      throw new BankStatementCsvError(
        `Linha ${line}: esperadas ${BANK_STATEMENT_HEADER.length} colunas, encontradas ${columns.length}.`,
        { line },
      );
    }

    const [dateRaw, timeRaw, typeRaw, nameRaw, detailRaw, valorRaw] = columns;

    const date = parseStatementDate(dateRaw);
    if (!date) {
      throw new BankStatementCsvError(
        `Linha ${line}: data "${dateRaw.trim()}" inválida.`,
        { line },
      );
    }

    const time = parseStatementTime(timeRaw);
    if (!time) {
      throw new BankStatementCsvError(
        `Linha ${line}: hora "${timeRaw.trim()}" inválida.`,
        { line },
      );
    }

    const amountCents = parseSignedBrlCents(valorRaw);
    if (amountCents === null) {
      throw new BankStatementCsvError(
        `Linha ${line}: valor "${valorRaw.trim()}" inválido.`,
        { line },
      );
    }

    const type = typeRaw.trim();
    const detail = detailRaw.trim();

    rows.push({
      line,
      date,
      time,
      type,
      detail,
      name: nameRaw.trim(),
      amountCents,
      kind: classify(type, detail),
    });
  }

  const consumed = new Set();
  const rescues = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.kind !== 'rescue') continue;

    const amountCents = Math.abs(row.amountCents);

    // The deposits that composed this rescue immediately follow it, up to the
    // next rescue.
    const run = [];
    let j = i + 1;
    while (j < rows.length && rows[j].kind === 'deposit' && !consumed.has(j)) {
      run.push({ index: j, row: rows[j] });
      j += 1;
    }

    let sumCents = 0;
    let matchedCount = 0;
    for (let k = 0; k < run.length; k += 1) {
      sumCents += run[k].row.amountCents;
      if (Math.abs(sumCents - amountCents) <= MATCH_TOLERANCE_CENTS) {
        matchedCount = k + 1;
        break;
      }
    }

    if (matchedCount > 0) {
      const selected = run.slice(0, matchedCount);
      selected.forEach((entry) => consumed.add(entry.index));
      rescues.push({
        line: row.line,
        date: row.date,
        time: row.time,
        name: row.name,
        amountCents,
        paired: true,
        sourceDeposits: selected.map((entry) => depositFrom(entry.row)),
      });
    } else {
      rescues.push({
        line: row.line,
        date: row.date,
        time: row.time,
        name: row.name,
        amountCents,
        paired: false,
        sourceDeposits: [],
      });
    }
  }

  let ignoredDepositCount = 0;
  let ignoredRowCount = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].kind === 'deposit' && !consumed.has(i))
      ignoredDepositCount += 1;
    if (rows[i].kind === 'other') ignoredRowCount += 1;
  }

  return { rescues, ignoredDepositCount, ignoredRowCount };
}

export {
  BANK_STATEMENT_HEADER,
  MATCH_TOLERANCE_CENTS as BANK_STATEMENT_MATCH_TOLERANCE_CENTS,
  BankStatementCsvError,
  parseBankStatement,
  parseSignedBrlCents,
};
