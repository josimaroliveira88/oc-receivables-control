// OFX 1.x SGML parser for the Banco do Brasil Ourocard credit-card statement.
// OFX is not always well-formed XML, so the reader is regex-driven over the
// `<STMTTRN>` blocks. Amounts become positive integer cents with a `PURCHASE`
// / `CREDIT` type (`TRNAMT` sign carries the direction). Statement payments
// (`PGTO DEBITO CONTA`) are credits of the previous invoice, not expenses, so
// they are flagged with an `ignoredReason` the reconcile preview skips.
import { toCents } from './money.js';

const STATEMENT_PAYMENT_MEMO = /PGTO DEBITO CONTA/i;
const INSTALLMENT_MEMO = /PARC\s+(\d{1,2})\s*\/\s*(\d{1,2})/i;

class CreditCardOfxError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CreditCardOfxError';
    this.status = 400;
  }
}

const readTag = (block, tag) => {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : null;
};

const normalizeMemo = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const parseOfxDate = (raw) => {
  const match = String(raw ?? '').match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) {
    throw new CreditCardOfxError('Data inválida no extrato OFX.');
  }
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
};

const parseAmountCents = (raw) => {
  const value = Number(String(raw ?? '').trim());
  if (!Number.isFinite(value)) {
    throw new CreditCardOfxError('Valor inválido no extrato OFX.');
  }
  return Math.abs(toCents(value));
};

function parseCreditCardOfx(ofxText) {
  const text = String(ofxText ?? '');
  if (!/<OFX>/i.test(text)) {
    throw new CreditCardOfxError('Arquivo OFX sem a tag <OFX>.');
  }
  if (!/<BANKTRANLIST>/i.test(text)) {
    throw new CreditCardOfxError('Arquivo OFX sem a lista de transações.');
  }

  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const rows = [];

  for (const block of blocks) {
    const trnType = (readTag(block, 'TRNTYPE') ?? '').toUpperCase();
    if (trnType === 'DEBIT') continue;

    const amountRaw = readTag(block, 'TRNAMT');
    if (amountRaw === null) {
      throw new CreditCardOfxError('Transação OFX sem valor.');
    }

    const memo = normalizeMemo(readTag(block, 'MEMO'));
    const parc = memo.match(INSTALLMENT_MEMO);
    const row = {
      date: parseOfxDate(readTag(block, 'DTPOSTED')),
      amountCents: parseAmountCents(amountRaw),
      type: amountRaw.startsWith('-') ? 'PURCHASE' : 'CREDIT',
      fitid: readTag(block, 'FITID'),
      memo,
      installmentNumber: parc ? Number(parc[1]) : null,
      installmentsTotal: parc ? Number(parc[2]) : null,
    };

    if (row.type === 'CREDIT' && STATEMENT_PAYMENT_MEMO.test(memo)) {
      row.ignoredReason = 'STATEMENT_PAYMENT';
    }

    rows.push(row);
  }

  return rows;
}

export { CreditCardOfxError, parseCreditCardOfx };
