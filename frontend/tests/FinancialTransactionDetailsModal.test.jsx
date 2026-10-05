import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import FinancialTransactionDetailsModal from '../src/pages/Finances/components/FinancialTransactionDetailsModal';

const makeTransaction = (overrides = {}) => ({
  id: 'tx-1',
  type: 'DESPESA',
  origin: 'PEDIDO_DOTERRA',
  amount: '250.00',
  description: 'Pedido dōTERRA P-0007',
  transactionDate: '2026-09-05T00:00:00.000Z',
  notes: null,
  isEffective: true,
  effectiveDate: null,
  installmentNumber: null,
  installmentsTotal: null,
  paymentType: null,
  feeAmount: null,
  categoryId: 'cat-doterra',
  category: {
    id: 'cat-doterra',
    name: 'Compra de produtos dōTERRA',
    type: 'DESPESA',
  },
  orderId: 'order-2',
  ...overrides,
});

const renderModal = (transaction, props = {}) =>
  render(
    <MemoryRouter>
      <FinancialTransactionDetailsModal transaction={transaction} {...props} />
    </MemoryRouter>,
  );

describe('FinancialTransactionDetailsModal', () => {
  it('renders the read-only summary of a transaction', () => {
    renderModal(makeTransaction());

    expect(screen.getByTestId('transaction-details-modal')).toBeInTheDocument();
    expect(screen.getByText('Detalhamento do lançamento')).toBeInTheDocument();
    expect(
      screen.getByTestId('transaction-details-description'),
    ).toHaveTextContent('Pedido dōTERRA P-0007');
    expect(screen.getByTestId('transaction-details-amount')).toHaveTextContent(
      /-\s*R\$\s*250,00/,
    );
    expect(screen.getByTestId('transaction-details-date')).toHaveTextContent(
      '05/09/2026',
    );
    expect(screen.getByTestId('transaction-details-origin')).toHaveTextContent(
      'Pedido dōTERRA',
    );
    expect(
      screen.getByTestId('transaction-details-category'),
    ).toHaveTextContent('Compra de produtos dōTERRA');
    expect(
      screen.getByTestId('transaction-details-effectiveness'),
    ).toHaveTextContent('Efetiva');
  });

  it('shows a positive sign for income', () => {
    renderModal(
      makeTransaction({
        type: 'RECEITA',
        origin: 'VENDA',
        amount: '100.00',
        description: 'Venda V-0001 — João Silva',
        category: { id: 'cat-vendas', name: 'Vendas', type: 'RECEITA' },
      }),
    );

    expect(screen.getByTestId('transaction-details-amount')).toHaveTextContent(
      /\+\s*R\$\s*100,00/,
    );
    expect(screen.getByTestId('transaction-details-type')).toHaveTextContent(
      'Receita',
    );
  });

  it('renders notes, gateway fee and installments when present', () => {
    renderModal(
      makeTransaction({
        notes: 'Recebido via InfinitePay',
        feeAmount: '3.00',
        installmentNumber: 2,
        installmentsTotal: 3,
        isEffective: false,
      }),
    );

    expect(screen.getByTestId('transaction-details-notes')).toHaveTextContent(
      'Recebido via InfinitePay',
    );
    expect(screen.getByTestId('transaction-details-fee')).toHaveTextContent(
      /R\$\s*3,00/,
    );
    expect(
      screen.getByTestId('transaction-details-installment'),
    ).toHaveTextContent('2/3');
    expect(
      screen.getByTestId('transaction-details-effectiveness'),
    ).toHaveTextContent('Pendente');
  });

  it('renders a dash for absent optional fields', () => {
    renderModal(
      makeTransaction({
        category: null,
        notes: null,
        feeAmount: null,
      }),
    );

    expect(
      screen.getByTestId('transaction-details-category'),
    ).toHaveTextContent('—');
    expect(screen.getByTestId('transaction-details-notes')).toHaveTextContent(
      '—',
    );
    expect(
      screen.queryByTestId('transaction-details-fee'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('transaction-details-installment'),
    ).not.toBeInTheDocument();
  });

  it('links an Uber ride expense back to its sale', () => {
    renderModal(
      makeTransaction({
        origin: 'UBER',
        description: 'Uber — Duo Residence Mall (Cássia)',
        category: { id: 'cat-transp', name: 'Transporte', type: 'DESPESA' },
        orderId: 'sale-9',
      }),
    );

    const saleLink = screen.getByTestId('transaction-details-sale');
    expect(saleLink).toHaveTextContent('Ver venda');
    expect(screen.getByRole('link', { name: /Ver venda/ })).toHaveAttribute(
      'href',
      '/sales?detailsSale=sale-9',
    );
  });

  it('hides the sale link for an Uber ride without a linked sale', () => {
    renderModal(
      makeTransaction({
        origin: 'UBER',
        description: 'Uber — Centro',
        orderId: null,
      }),
    );

    expect(
      screen.queryByTestId('transaction-details-sale'),
    ).not.toBeInTheDocument();
  });

  it('closes through the close button and the footer button', () => {
    const onClose = vi.fn();
    renderModal(makeTransaction(), { onClose });

    fireEvent.click(
      screen.getByRole('button', { name: 'Fechar detalhamento' }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
