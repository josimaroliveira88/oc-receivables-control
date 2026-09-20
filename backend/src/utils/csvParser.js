import fs from 'fs';

function parseProductCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];

  const dataLines = lines.slice(1);
  const rows = [];

  for (const line of dataLines) {
    const cols = line.split(';').map((col) => col.trim());
    if (cols.length < 6) {
      throw new Error(`Invalid row: ${line}`);
    }
    const [code, name, size, regularPrice, memberPrice, pv] = cols;
    if (!code || !name) continue;

    rows.push({
      code,
      name,
      size: size || '',
      regularPrice,
      memberPrice,
      pv,
    });
  }

  return rows;
}

function parseProductCsvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseProductCsv(content);
}

// --- InfinitePay statement parser ------------------------------------------

// Canonical InfinitePay report header. The statement export is comma-delimited
// with a fixed 15-column layout; any divergence means the file is not the
// expected report, so we reject it instead of guessing.
const INFINITE_PAY_HEADER = [
  'Data e hora',
  'Meio - Meio',
  'Meio - Bandeira',
  'Meio - Parcelas',
  'Tipo - Origem',
  'Tipo - Dados adicionais',
  'Identificador',
  'Status',
  'Valor (R$)',
  'Líquido (R$)',
  'Taxa Aplicada - Valor(R$)',
  'Taxa Aplicada - Aplicada(%)',
  'Plano',
  'NSU',
  'Origem - Nome',
];

const INFINITE_PAY_STATUSES = new Set(['Aprovada', 'Negada']);

const BRL_AMOUNT = /^-?\d+(\.\d{1,2})?$/;

// Domain error thrown when an InfinitePay CSV is not in the expected layout.
// `line` (1-based, including the header) lets the caller point the user at the
// offending row.
class InfinitePayCsvError extends Error {
  constructor(message, { line } = {}) {
    super(message);
    this.name = 'InfinitePayCsvError';
    if (line !== undefined) this.line = line;
  }
}

// Minimal RFC 4180 reader: handles quoted fields, escaped quotes ("") and line
// breaks inside quotes. Entirely blank records are dropped so callers get only
// real rows. Returns `{ line, fields }` records, where `line` is the 1-based
// physical line the record starts on (used in error messages).
function parseCsvRecords(text) {
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;
  let lineNumber = 1;
  let recordLine = 1;

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    records.push({ line: recordLine, fields: record });
    record = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
        if (char === '\n') lineNumber += 1;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\r') {
      if (text[i + 1] === '\n') i += 1;
      pushRecord();
      lineNumber += 1;
      recordLine = lineNumber;
    } else if (char === '\n') {
      pushRecord();
      lineNumber += 1;
      recordLine = lineNumber;
    } else {
      field += char;
    }
  }

  if (record.length > 0 || field !== '') {
    pushField();
    records.push({ line: recordLine, fields: record });
  }

  return records.filter(
    ({ fields }) => !(fields.length === 1 && fields[0].trim() === ''),
  );
}

// Parses a Brazilian monetary string into integer cents. Handles the
// apostrophe prefix and spaces the report adds to fees ('- 14,01' / "'- 14,01").
// Returns null when the value is not a valid amount.
function parseBrlCents(raw) {
  const cleaned = String(raw ?? '')
    .replace(/'/g, '')
    .replace(/\s/g, '');
  if (cleaned === '') return null;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  if (!BRL_AMOUNT.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}

// Parses the 'DD/MM/YYYY HH:MM' date column into calendar strings (YYYY-MM-DD
// and HH:MM), validating the real date (31/02 is rejected) without timezone
// shifts. Returns null when the value is not a valid date.
function parseInfinitePayDate(raw) {
  const match = String(raw ?? '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) return null;

  const [, day, month, year, hour = '00', minute = '00'] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(y, m - 1, d, Number(hour), Number(minute));
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }

  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

// Parses an InfinitePay statement into normalized rows. Throws
// `InfinitePayCsvError` when the header diverges or any row is malformed, so an
// out-of-pattern file never proceeds. Denied rows are returned as-is; filtering
// them is the caller's decision.
function parseInfinitePayCsv(csvText) {
  const records = parseCsvRecords(String(csvText ?? '').replace(/^\uFEFF/, ''));

  if (records.length === 0) {
    throw new InfinitePayCsvError('O arquivo CSV está vazio.');
  }

  const header = records[0].fields.map((column) => column.trim());
  const headerMatches =
    header.length === INFINITE_PAY_HEADER.length &&
    INFINITE_PAY_HEADER.every((name, index) => header[index] === name);
  if (!headerMatches) {
    throw new InfinitePayCsvError(
      'Cabeçalho fora do padrão do InfinitePay. Exporte o relatório novamente.',
    );
  }

  const rows = [];
  for (let index = 1; index < records.length; index += 1) {
    const { fields: columns, line } = records[index];

    if (columns.length !== INFINITE_PAY_HEADER.length) {
      throw new InfinitePayCsvError(
        `Linha ${line}: esperadas ${INFINITE_PAY_HEADER.length} colunas, encontradas ${columns.length}.`,
        { line },
      );
    }

    const [
      dateRaw,
      meio,
      bandeira,
      parcelas,
      tipoOrigem,
      dadosAdicionais,
      identificador,
      statusRaw,
      valorRaw,
      liquidoRaw,
      taxaRaw,
      taxaPercentRaw,
      plano,
      nsu,
      origemNome,
    ] = columns;

    const status = statusRaw.trim();
    if (!INFINITE_PAY_STATUSES.has(status)) {
      throw new InfinitePayCsvError(
        `Linha ${line}: status "${status}" não reconhecido.`,
        { line },
      );
    }

    const occurredAt = parseInfinitePayDate(dateRaw);
    if (!occurredAt) {
      throw new InfinitePayCsvError(
        `Linha ${line}: data "${dateRaw.trim()}" inválida.`,
        { line },
      );
    }

    const valorCents = parseBrlCents(valorRaw);
    if (valorCents === null) {
      throw new InfinitePayCsvError(
        `Linha ${line}: valor "${valorRaw.trim()}" inválido.`,
        { line },
      );
    }

    const liquidoCents = parseBrlCents(liquidoRaw);
    if (liquidoCents === null) {
      throw new InfinitePayCsvError(
        `Linha ${line}: líquido "${liquidoRaw.trim()}" inválido.`,
        { line },
      );
    }

    const taxaCents = parseBrlCents(taxaRaw) ?? 0;
    const taxaPercent = parseFloat(
      String(taxaPercentRaw ?? '')
        .replace(/'/g, '')
        .replace(',', '.'),
    );

    rows.push({
      line,
      date: occurredAt.date,
      time: occurredAt.time,
      meio: meio.trim(),
      bandeira: bandeira.trim(),
      parcelas: parcelas.trim(),
      tipoOrigem: tipoOrigem.trim(),
      dadosAdicionais: dadosAdicionais.trim(),
      identificador: identificador.trim(),
      status,
      valorCents,
      liquidoCents,
      taxaCents,
      taxaPercent: Number.isFinite(taxaPercent) ? taxaPercent : 0,
      plano: plano.trim(),
      nsu: nsu.trim(),
      origemNome: origemNome.trim(),
    });
  }

  return rows;
}

function parseInfinitePayCsvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseInfinitePayCsv(content);
}

export {
  parseProductCsv,
  parseProductCsvFile,
  parseCsvRecords,
  parseInfinitePayCsv,
  parseInfinitePayCsvFile,
  InfinitePayCsvError,
  INFINITE_PAY_HEADER,
};
