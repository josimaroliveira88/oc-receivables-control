import {
  decorateSaleForRescue,
  matchAmountToSales,
} from '../src/utils/rescueHelpers.js';

const sale = ({
  id = 's1',
  orderNumber = 'V-0001',
  totalValue = '220.01',
  clientName = 'João Silva',
  payments = [],
} = {}) => ({
  id,
  orderNumber,
  totalValue,
  items: clientName ? [{ person: { name: clientName } }] : [],
  payments,
});

const infinitePay = ({
  id = 'pay-1',
  amount = '220.01',
  netAmount = null,
} = {}) => ({ id, paymentType: 'INFINITE_PAY', amount, netAmount });

describe('decorateSaleForRescue', () => {
  it('projects totals, payments and the rescuable amount', () => {
    const decorated = decorateSaleForRescue(
      sale({
        totalValue: '240.01',
        payments: [infinitePay({ amount: '270.85', netAmount: '240.01' })],
      }),
    );

    expect(decorated).toMatchObject({
      id: 's1',
      orderNumber: 'V-0001',
      clientName: 'João Silva',
      totalCents: 24001,
      paidCents: 27085,
      pendingCents: 0,
      hasInfinitePay: true,
      rescuableCents: 24001,
    });
    expect(decorated.infinitePayPayments).toEqual([
      {
        id: 'pay-1',
        grossCents: 27085,
        netCents: 24001,
        paidAt: undefined,
      },
    ]);
  });

  it('falls back to the gross amount when no net was informed', () => {
    const decorated = decorateSaleForRescue(
      sale({ payments: [infinitePay({ netAmount: null })] }),
    );
    expect(decorated.infinitePayPayments[0].netCents).toBe(22001);
    expect(decorated.rescuableCents).toBe(22001);
  });

  it('subtracts already redeemed amounts from the rescuable total', () => {
    const decorated = decorateSaleForRescue(
      sale({ payments: [infinitePay({ netAmount: '240.01' })] }),
      { s1: 10001 },
    );
    expect(decorated.settledCents).toBe(10001);
    expect(decorated.rescuableCents).toBe(14000);
  });

  it('never reports a negative rescuable amount', () => {
    const decorated = decorateSaleForRescue(
      sale({ payments: [infinitePay({ netAmount: '100.00' })] }),
      { s1: 15000 },
    );
    expect(decorated.rescuableCents).toBe(0);
  });

  it('flags sales without an InfinitePay payment', () => {
    const decorated = decorateSaleForRescue(
      sale({ payments: [{ id: 'p', paymentType: 'PIX', amount: '100.00' }] }),
    );
    expect(decorated.hasInfinitePay).toBe(false);
    expect(decorated.rescuableCents).toBe(0);
  });
});

describe('matchAmountToSales', () => {
  const netSale = sale({
    payments: [infinitePay({ netAmount: '220.01' })],
  });
  const grossSale = sale({
    id: 's2',
    orderNumber: 'V-0002',
    totalValue: '234.02',
    clientName: 'Maria',
    payments: [
      infinitePay({ id: 'pay-2', amount: '234.02', netAmount: '220.01' }),
    ],
  });

  const decorateAll = (sales, settled = {}) =>
    sales.map((s) => decorateSaleForRescue(s, settled));

  it('matches a sale by its InfinitePay net amount', () => {
    const matches = matchAmountToSales(
      22001,
      decorateAll([netSale, grossSale]),
    );
    expect(matches.map((m) => m.saleId)).toContain('s1');
    expect(matches.find((m) => m.saleId === 's1').matchType).toBe('net');
  });

  it('matches a sale by its InfinitePay gross amount', () => {
    const matches = matchAmountToSales(23402, decorateAll([grossSale]));
    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe('gross');
    expect(matches[0].suggestedCents).toBe(23402);
  });

  it('matches a sale by its total value', () => {
    const plain = sale({
      id: 's3',
      orderNumber: 'V-0003',
      totalValue: '100.00',
      payments: [infinitePay({ id: 'pay-3', amount: '100.00' })],
    });
    const matches = matchAmountToSales(10000, decorateAll([plain]));
    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe('net');
  });

  it('honours the 2-cent tolerance and rejects beyond it', () => {
    const decorated = decorateAll([netSale]);
    expect(matchAmountToSales(22003, decorated)).toHaveLength(1);
    expect(matchAmountToSales(22004, decorated)).toHaveLength(0);
  });

  it('ignores sales without an InfinitePay payment', () => {
    const pixOnly = sale({
      id: 's4',
      payments: [{ id: 'p', paymentType: 'PIX', amount: '220.01' }],
    });
    expect(matchAmountToSales(22001, decorateAll([pixOnly]))).toEqual([]);
  });

  it('sorts matches by distance and exposes pending/rescuable', () => {
    const close = sale({
      id: 'close',
      orderNumber: 'V-0001',
      payments: [infinitePay({ netAmount: '220.02' })],
    });
    const far = sale({
      id: 'far',
      orderNumber: 'V-0002',
      payments: [infinitePay({ netAmount: '220.03' })],
    });
    const matches = matchAmountToSales(22001, decorateAll([far, close]));
    expect(matches.map((m) => m.saleId)).toEqual(['close', 'far']);
    expect(matches[0]).toHaveProperty('pendingCents');
    expect(matches[0]).toHaveProperty('rescuableCents');
  });

  it('reports the matched payment id', () => {
    const matches = matchAmountToSales(22001, decorateAll([netSale]));
    expect(matches[0].paymentId).toBe('pay-1');
  });
});
