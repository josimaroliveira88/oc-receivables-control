import {
  parseInfinitePayCsv,
  InfinitePayCsvError,
} from '../src/utils/csvParser.js';

const HEADER = [
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
].join(',');

const APPROVED_ROW = `16/09/2026 08:47,Crédito,mastercard,À Vista,Gestão de Cobrança,'-,397720,Aprovada,"234,02","220,01","'- 14,01",5.98,Nitro,1ae51a8f-9931-4f46-9370-9a9c4c3f5987,ALINE F A FERNANDES`;

const DENIED_ROW = `28/08/2026 15:11,Crédito,visa,2,Gestão de Cobrança,'-,000000,Negada,"237,20","237,20","0,00",0,1 Dia Útil,fa224fec-6550-465a-8dff-00f2edcaae49,Greyziele s m Esteves`;

const join = (...lines) => lines.join('\n');

describe('parseInfinitePayCsv', () => {
  it('parses the header and the approved rows into structured fields', () => {
    const rows = parseInfinitePayCsv(join(HEADER, APPROVED_ROW));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      line: 2,
      date: '2026-09-16',
      time: '08:47',
      meio: 'Crédito',
      bandeira: 'mastercard',
      parcelas: 'À Vista',
      tipoOrigem: 'Gestão de Cobrança',
      identificador: '397720',
      status: 'Aprovada',
      valorCents: 23402,
      liquidoCents: 22001,
      taxaCents: -1401,
      taxaPercent: 5.98,
      plano: 'Nitro',
      nsu: '1ae51a8f-9931-4f46-9370-9a9c4c3f5987',
      origemNome: 'ALINE F A FERNANDES',
    });
  });

  it('keeps denied rows so the caller can decide whether to filter them', () => {
    const rows = parseInfinitePayCsv(join(HEADER, DENIED_ROW));

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('Negada');
    expect(rows[0].valorCents).toBe(23720);
  });

  it('strips the apostrophe prefix from monetary fields', () => {
    const rows = parseInfinitePayCsv(join(HEADER, APPROVED_ROW));
    expect(rows[0].taxaCents).toBe(-1401);
  });

  it('parses negative fees without the surrounding space too', () => {
    const row = APPROVED_ROW.replace(`"'- 14,01"`, '"-14,01"');
    const rows = parseInfinitePayCsv(join(HEADER, row));
    expect(rows[0].taxaCents).toBe(-1401);
  });

  it('strips a UTF-8 BOM from the header', () => {
    const rows = parseInfinitePayCsv(join(`\uFEFF${HEADER}`, APPROVED_ROW));
    expect(rows).toHaveLength(1);
  });

  it('ignores blank lines between records', () => {
    const rows = parseInfinitePayCsv(join(HEADER, '', APPROVED_ROW, '   ', ''));
    expect(rows).toHaveLength(1);
    expect(rows[0].line).toBe(3);
  });

  it('keeps commas and escaped quotes inside quoted fields', () => {
    const row = APPROVED_ROW.replace(
      'ALINE F A FERNANDES',
      '"SILVA, JOÃO ""JR"""',
    );
    const rows = parseInfinitePayCsv(join(HEADER, row));
    expect(rows[0].origemNome).toBe('SILVA, JOÃO "JR"');
  });

  it('throws on an empty file', () => {
    expect(() => parseInfinitePayCsv('')).toThrow(InfinitePayCsvError);
  });

  it('throws when the header does not match the InfinitePay layout', () => {
    const badHeader = HEADER.replace('Valor (R$)', 'Valor');
    expect(() => parseInfinitePayCsv(join(badHeader, APPROVED_ROW))).toThrow(
      /Cabeçalho fora do padrão/,
    );
  });

  it('throws when a column is missing from the header', () => {
    const badHeader = HEADER.split(',').slice(0, 14).join(',');
    expect(() => parseInfinitePayCsv(join(badHeader, APPROVED_ROW))).toThrow(
      /Cabeçalho fora do padrão/,
    );
  });

  it('throws on a row with the wrong number of columns and reports the line', () => {
    const shortRow = APPROVED_ROW.replace(',ALINE F A FERNANDES', '');
    let error;
    try {
      parseInfinitePayCsv(join(HEADER, shortRow));
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(InfinitePayCsvError);
    expect(error.line).toBe(2);
    expect(error.message).toMatch(/Linha 2/);
  });

  it('throws on an invalid date', () => {
    const badRow = APPROVED_ROW.replace('16/09/2026 08:47', '31/02/2026 08:47');
    expect(() => parseInfinitePayCsv(join(HEADER, badRow))).toThrow(/data/i);
  });

  it('throws on a non-numeric gross amount', () => {
    const badRow = APPROVED_ROW.replace('"234,02"', '"abc"');
    expect(() => parseInfinitePayCsv(join(HEADER, badRow))).toThrow(/valor/i);
  });

  it('throws on a non-numeric net amount', () => {
    const badRow = APPROVED_ROW.replace('"220,01"', '""');
    expect(() => parseInfinitePayCsv(join(HEADER, badRow))).toThrow(/líquido/i);
  });

  it('throws on an unknown status', () => {
    const badRow = APPROVED_ROW.replace('Aprovada', 'Pendente');
    expect(() => parseInfinitePayCsv(join(HEADER, badRow))).toThrow(/status/i);
  });

  it('handles CRLF line endings', () => {
    const rows = parseInfinitePayCsv(
      [HEADER, APPROVED_ROW].join('\r\n') + '\r\n',
    );
    expect(rows).toHaveLength(1);
  });
});
