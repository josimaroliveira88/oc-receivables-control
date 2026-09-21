import { parseCreditCardOfx } from '../src/utils/creditCardOfxParser.js';

const block = ({ type = 'PAYMENT', date, amount, fitid, memo }) =>
  `<STMTTRN><TRNTYPE>${type}</TRNTYPE>
<DTPOSTED>${date}</DTPOSTED>
<TRNAMT>${amount}</TRNAMT>
<FITID>${fitid}</FITID>
<MEMO>${memo}</MEMO>
</STMTTRN>`;

const ofx = (...blocks) => `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE
<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<CURDEF>BRL</CURDEF>
<BANKTRANLIST>
<DTSTART>20250101</DTSTART>
<DTEND>20260907</DTEND>
${blocks.join('\n')}
</BANKTRANLIST>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>`;

describe('creditCardOfxParser', () => {
  it('returns one row per STMTTRN with the expected shape', () => {
    const rows = parseCreditCardOfx(
      ofx(
        block({
          type: 'PAYMENT',
          date: '20260817',
          amount: '-438.64',
          fitid: 'FIT-1',
          memo: 'DOTERRA PARC 01/04',
        }),
        block({
          type: 'CREDIT',
          date: '20260820',
          amount: '6756.69',
          fitid: 'FIT-2',
          memo: 'PGTO DEBITO CONTA',
        }),
      ),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: '2026-08-17',
      amountCents: 43864,
      type: 'PURCHASE',
      fitid: 'FIT-1',
      memo: 'DOTERRA PARC 01/04',
    });
    expect(rows[1]).toMatchObject({
      date: '2026-08-20',
      amountCents: 675669,
      type: 'CREDIT',
      fitid: 'FIT-2',
      memo: 'PGTO DEBITO CONTA',
    });
  });

  it('turns a negative amount into a positive PURCHASE and a positive amount into CREDIT', () => {
    const rows = parseCreditCardOfx(
      ofx(
        block({
          date: '20260815',
          amount: '-205.70',
          fitid: 'FIT-A',
          memo: 'BJA COMERCIO',
        }),
        block({
          type: 'CREDIT',
          date: '20260820',
          amount: '0.31',
          fitid: 'FIT-B',
          memo: 'DOACAO ARREDT FAT',
        }),
      ),
    );

    expect(rows.map((row) => row.type)).toEqual(['PURCHASE', 'CREDIT']);
    expect(rows.map((row) => row.amountCents)).toEqual([20570, 31]);
  });

  it('extracts the PARC nn/mm installment number and total from the memo', () => {
    const rows = parseCreditCardOfx(
      ofx(
        block({
          date: '20260828',
          amount: '-185.65',
          fitid: 'FIT-PARC',
          memo: 'DOTERRA PARC 01/06 BARUERI BR',
        }),
        block({
          date: '20260820',
          amount: '-30.00',
          fitid: 'FIT-PLAIN',
          memo: 'ZIGPAY CURITIBA BR',
        }),
      ),
    );

    expect(rows[0].installmentNumber).toBe(1);
    expect(rows[0].installmentsTotal).toBe(6);
    expect(rows[1].installmentNumber).toBeNull();
    expect(rows[1].installmentsTotal).toBeNull();
  });

  it('parses the YYYYMMDD date as a local YYYY-MM-DD date', () => {
    const rows = parseCreditCardOfx(
      ofx(
        block({
          date: '20260907',
          amount: '-112.88',
          fitid: 'FIT-C',
          memo: 'CAPPTA TAVERNA',
        }),
      ),
    );

    expect(rows[0].date).toBe('2026-09-07');
  });

  it('trims the memo and collapses internal whitespace', () => {
    const rows = parseCreditCardOfx(
      ofx(
        block({
          date: '20260829',
          amount: '-227.05',
          fitid: 'FIT-D',
          memo: '  VUP AGUAS CLA          BRASILIA      BR  ',
        }),
      ),
    );

    expect(rows[0].memo).toBe('VUP AGUAS CLA BRASILIA BR');
  });

  it('skips DEBIT transactions and flags statement payments as ignored', () => {
    const rows = parseCreditCardOfx(
      ofx(
        block({
          type: 'DEBIT',
          date: '20260810',
          amount: '-50.00',
          fitid: 'FIT-DEBIT',
          memo: 'TARIFA',
        }),
        block({
          type: 'CREDIT',
          date: '20260820',
          amount: '6756.69',
          fitid: 'FIT-PAY',
          memo: 'PGTO DEBITO CONTA 8435',
        }),
        block({
          date: '20260815',
          amount: '-205.70',
          fitid: 'FIT-E',
          memo: 'BJA COMERCIO',
        }),
      ),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].fitid).toBe('FIT-PAY');
    expect(rows[0].ignoredReason).toBe('STATEMENT_PAYMENT');
    expect(rows[1].fitid).toBe('FIT-E');
    expect(rows[1].ignoredReason).toBeUndefined();
  });

  it('rejects text without the OFX root', () => {
    expect(() => parseCreditCardOfx('<SOMETHING>no ofx here')).toThrow();
  });

  it('rejects text without a BANKTRANLIST', () => {
    expect(() =>
      parseCreditCardOfx('<OFX><SIGNONMSGSRSV1></SIGNONMSGSRSV1></OFX>'),
    ).toThrow();
  });
});
