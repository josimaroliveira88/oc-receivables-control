/* eslint-disable react/prop-types */
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InfinitePayImportModal from '../src/pages/Sales/components/InfinitePayImportModal';

const row = {
  line: 2,
  date: '2026-09-16',
  time: '08:47',
  valorCents: 23402,
  liquidoCents: 22001,
  taxaCents: -1401,
  origemNome: 'ALINE F FERNANDES',
  matches: [
    {
      saleId: 'sale-1',
      orderNumber: 'V-0001',
      totalCents: 22001,
      clientName: 'Aline Fernandes',
      pendingCents: 22001,
      matchType: 'net',
    },
    {
      saleId: 'sale-2',
      orderNumber: 'V-0002',
      totalCents: 23402,
      clientName: 'Aline F',
      pendingCents: 23402,
      matchType: 'gross',
    },
  ],
};

// Mirrors how the page wires the hook state back into the controlled modal.
const Harness = ({ usedLines = new Set(), onSelectSale, onRequestFile }) => {
  const [expandedLine, setExpandedLine] = useState(null);
  return (
    <InfinitePayImportModal
      isOpen
      rows={[row]}
      ignoredCount={0}
      usedLines={usedLines}
      expandedLine={expandedLine}
      onClose={vi.fn()}
      onToggleRow={setExpandedLine}
      onSelectSale={onSelectSale}
      onRequestFile={onRequestFile}
    />
  );
};

describe('InfinitePayImportModal', () => {
  it('lists the statement rows with values and the origin name', () => {
    render(<Harness />);

    expect(screen.getByText('ALINE F FERNANDES')).toBeInTheDocument();
    expect(screen.getByText(/234,02/)).toBeInTheDocument();
    expect(screen.getByText(/220,01/)).toBeInTheDocument();
    expect(screen.getByText('2 venda(s)')).toBeInTheDocument();
  });

  it('shows the ignored (Negada) count', () => {
    render(<InfinitePayImportModal isOpen rows={[row]} ignoredCount={4} />);
    expect(screen.getByTestId('infinitepay-import-ignored')).toHaveTextContent(
      '4 ignorado(s) por status Negada',
    );
  });

  it('expands a row to reveal the suggested sales', () => {
    render(<Harness />);

    expect(screen.queryByText(/V-0001/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('2 venda(s)'));

    expect(screen.getByText(/V-0001/)).toBeInTheDocument();
    expect(screen.getByText(/V-0002/)).toBeInTheDocument();
    expect(screen.getByText('Igual ao líquido')).toBeInTheDocument();
    expect(screen.getByText('Igual ao valor')).toBeInTheDocument();
  });

  it('calls onSelectSale with the row and the chosen match', () => {
    const onSelectSale = vi.fn();
    render(<Harness onSelectSale={onSelectSale} />);

    fireEvent.click(screen.getByText('2 venda(s)'));
    fireEvent.click(screen.getAllByText('Usar esta venda')[0]);

    expect(onSelectSale).toHaveBeenCalledWith(row, row.matches[0]);
  });

  it('marks a used row and hides its action', () => {
    render(<Harness usedLines={new Set([2])} />);

    expect(screen.getByText('Usada')).toBeInTheDocument();
    expect(screen.queryByText('2 venda(s)')).not.toBeInTheDocument();
  });

  it('renders the error state without the table', () => {
    render(
      <InfinitePayImportModal
        isOpen
        rows={[]}
        error="Linha 3: data inválida."
      />,
    );

    expect(screen.getByTestId('infinitepay-import-error')).toHaveTextContent(
      'Linha 3: data inválida.',
    );
    expect(screen.queryByText('ALINE F FERNANDES')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no approved rows', () => {
    render(<InfinitePayImportModal isOpen rows={[]} />);
    expect(
      screen.getByText('Nenhum lançamento aprovado encontrado no arquivo.'),
    ).toBeInTheDocument();
  });

  it('offers to pick another file', () => {
    const onRequestFile = vi.fn();
    render(<Harness onRequestFile={onRequestFile} />);
    fireEvent.click(screen.getByText('Selecionar outro arquivo'));
    expect(onRequestFile).toHaveBeenCalledTimes(1);
  });
});
