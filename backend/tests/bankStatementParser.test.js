import {
  parseBankStatement,
  BankStatementCsvError,
  BANK_STATEMENT_HEADER,
} from '../src/utils/bankStatementParser.js';

const HEADER = BANK_STATEMENT_HEADER.join(',');

const rescueRow = ({
  date = '2026-09-16',
  time = '08:50:45',
  name = 'Pix CASSIA GOUVEIA LIMA',
  value = '-R$ 220,01',
} = {}) => `${date},${time},Pix,"${name}",Enviado,"${value}"`;

const depositRow = ({
  date = '2026-09-16',
  time = '08:47:16',
  name = 'Venda Nitro',
  value = '+R$ 220,01',
} = {}) =>
  `${date},${time},Depósito de vendas,"${name}",Depósito InfinitePay,"${value}"`;

const join = (...lines) => lines.join('\n');

describe('parseBankStatement', () => {
  it('parses a single rescue paired with its deposit', () => {
    const parsed = parseBankStatement(join(HEADER, rescueRow(), depositRow()));

    expect(parsed.rescues).toHaveLength(1);
    const [rescue] = parsed.rescues;
    expect(rescue).toMatchObject({
      line: 2,
      date: '2026-09-16',
      time: '08:50',
      amountCents: 22001,
      paired: true,
    });
    expect(rescue.sourceDeposits).toEqual([
      {
        line: 3,
        date: '2026-09-16',
        time: '08:47',
        amountCents: 22001,
        name: 'Venda Nitro',
      },
    ]);
    expect(parsed.ignoredDepositCount).toBe(0);
  });

  it('pairs a rescue whose deposit is on a different day', () => {
    const parsed = parseBankStatement(
      join(
        HEADER,
        rescueRow({ date: '2026-08-17', value: '-R$ 186,71' }),
        depositRow({
          date: '2026-08-14',
          time: '00:58:46',
          name: 'Vendas',
          value: '+R$ 186,71',
        }),
      ),
    );

    expect(parsed.rescues[0].paired).toBe(true);
    expect(parsed.rescues[0].sourceDeposits).toHaveLength(1);
    expect(parsed.rescues[0].sourceDeposits[0].date).toBe('2026-08-14');
  });

  it('pairs a rescue that bundles multiple deposits', () => {
    const parsed = parseBankStatement(
      join(
        HEADER,
        rescueRow({ time: '07:43:37', value: '-R$ 495,32' }),
        depositRow({ time: '02:16:50', name: 'Vendas', value: '+R$ 334,15' }),
        depositRow({ time: '02:16:50', name: 'Vendas', value: '+R$ 161,17' }),
      ),
    );

    expect(parsed.rescues).toHaveLength(1);
    expect(parsed.rescues[0].paired).toBe(true);
    expect(parsed.rescues[0].sourceDeposits.map((d) => d.amountCents)).toEqual([
      33415, 16117,
    ]);
    expect(parsed.ignoredDepositCount).toBe(0);
  });

  it('pairs multiple consecutive rescues with their own deposits', () => {
    const parsed = parseBankStatement(
      join(
        HEADER,
        rescueRow({ time: '08:50:45', value: '-R$ 220,01' }),
        depositRow({ time: '08:47:16', value: '+R$ 220,01' }),
        rescueRow({ time: '15:34:13', value: '-R$ 240,01' }),
        depositRow({
          date: '2026-09-14',
          time: '13:38:06',
          value: '+R$ 240,01',
        }),
      ),
    );

    expect(parsed.rescues).toHaveLength(2);
    expect(parsed.rescues[0].sourceDeposits).toHaveLength(1);
    expect(parsed.rescues[1].sourceDeposits).toHaveLength(1);
    expect(parsed.rescues[1].sourceDeposits[0].amountCents).toBe(24001);
    expect(parsed.ignoredDepositCount).toBe(0);
  });

  it('matches within the 2-cent tolerance', () => {
    const parsed = parseBankStatement(
      join(
        HEADER,
        rescueRow({ value: '-R$ 220,01' }),
        depositRow({ value: '+R$ 220,03' }),
      ),
    );

    expect(parsed.rescues[0].paired).toBe(true);
  });

  it('marks a rescue unpaired when no deposit combination matches', () => {
    const parsed = parseBankStatement(
      join(
        HEADER,
        rescueRow({ value: '-R$ 220,01' }),
        depositRow({ value: '+R$ 300,00' }),
      ),
    );

    expect(parsed.rescues[0].paired).toBe(false);
    expect(parsed.rescues[0].sourceDeposits).toEqual([]);
    expect(parsed.ignoredDepositCount).toBe(1);
  });

  it('counts deposits that precede any rescue as ignored', () => {
    const parsed = parseBankStatement(
      join(
        HEADER,
        depositRow({
          date: '2026-09-30',
          time: '09:00:00',
          value: '+R$ 50,00',
        }),
        rescueRow({ value: '-R$ 220,01' }),
        depositRow({ value: '+R$ 220,01' }),
      ),
    );

    expect(parsed.rescues).toHaveLength(1);
    expect(parsed.rescues[0].paired).toBe(true);
    expect(parsed.ignoredDepositCount).toBe(1);
  });

  it('ignores rows that are neither a rescue nor a deposit', () => {
    const other = '2026-09-16,08:50:45,TED,Banco X,Enviado,"-R$ 10,00"';
    const parsed = parseBankStatement(
      join(HEADER, other, rescueRow(), depositRow()),
    );

    expect(parsed.rescues).toHaveLength(1);
    expect(parsed.ignoredRowCount).toBe(1);
  });

  it('strips a UTF-8 BOM from the header', () => {
    const parsed = parseBankStatement(
      join(`\uFEFF${HEADER}`, rescueRow(), depositRow()),
    );
    expect(parsed.rescues).toHaveLength(1);
  });

  it('handles CRLF line endings', () => {
    const parsed = parseBankStatement(
      [HEADER, rescueRow(), depositRow()].join('\r\n') + '\r\n',
    );
    expect(parsed.rescues).toHaveLength(1);
  });

  it('throws on an empty file', () => {
    expect(() => parseBankStatement('')).toThrow(BankStatementCsvError);
  });

  it('throws when the header diverges', () => {
    const badHeader = HEADER.replace('Valor', 'Montante');
    expect(() =>
      parseBankStatement(join(badHeader, rescueRow(), depositRow())),
    ).toThrow(/Cabeçalho fora do padrão/);
  });

  it('throws on a malformed row and reports the line', () => {
    const bad = '31/02/2026,08:50:45,Pix,X,Enviado,"-R$ 10,00"';
    let error;
    try {
      parseBankStatement(join(HEADER, bad));
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(BankStatementCsvError);
    expect(error.line).toBe(2);
  });

  it('throws on an invalid amount', () => {
    const bad = '2026-09-16,08:50:45,Pix,X,Enviado,"abc"';
    expect(() => parseBankStatement(join(HEADER, bad))).toThrow(/valor/i);
  });

  it('parses the project sample extract end to end', () => {
    const sample = [
      HEADER,
      '2026-09-16,08:50:45,Pix,Pix CASSIA GOUVEIA LIMA,Enviado,"-R$ 220,01"',
      '2026-09-16,08:47:16,Depósito de vendas,Venda Nitro,Depósito InfinitePay,"+R$ 220,01"',
      '2026-08-31,07:43:37,Pix,Pix CASSIA GOUVEIA LIMA,Enviado,"-R$ 495,32"',
      '2026-08-31,02:16:50,Depósito de vendas,Vendas,Depósito InfinitePay,"+R$ 334,15"',
      '2026-08-31,02:16:50,Depósito de vendas,Vendas,Depósito InfinitePay,"+R$ 161,17"',
    ].join('\n');

    const parsed = parseBankStatement(sample);
    expect(parsed.rescues).toHaveLength(2);
    expect(parsed.rescues.every((rescue) => rescue.paired)).toBe(true);
    expect(parsed.rescues[1].sourceDeposits).toHaveLength(2);
    expect(parsed.ignoredDepositCount).toBe(0);
    expect(parsed.ignoredRowCount).toBe(0);
  });
});
