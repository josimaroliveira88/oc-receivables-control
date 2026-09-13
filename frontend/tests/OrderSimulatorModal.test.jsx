import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import OrderSimulatorModal from '../src/pages/Orders/components/OrderSimulatorModal';
import { useOrderSimulator } from '../src/pages/Orders/useOrderSimulator';

const products = [
  {
    id: 'p1',
    code: '60226006',
    name: 'Adaptiv Pastilhas',
    memberPrice: '231.25',
    pv: '31',
  },
  {
    id: 'p2',
    code: '60226007',
    name: 'Óleo de Lavanda',
    memberPrice: '180.00',
    pv: '30',
  },
];

const Harness = () => {
  const {
    isOpen,
    rows,
    openSimulator,
    closeSimulator,
    addRow,
    removeRow,
    updateRowField,
    clearAll,
  } = useOrderSimulator();
  return (
    <>
      <button type="button" onClick={openSimulator}>
        Abrir
      </button>
      <OrderSimulatorModal
        isOpen={isOpen}
        rows={rows}
        products={products}
        onClose={closeSimulator}
        onAddRow={addRow}
        onUpdateField={updateRowField}
        onRemoveRow={removeRow}
        onClearAll={clearAll}
      />
    </>
  );
};

const openSimulator = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));

const addRow = () => fireEvent.click(screen.getByTestId('simulator-add-row'));

const selectProduct = (index, name) => {
  const row = screen.getByTestId(`simulator-row-${index}`);
  fireEvent.change(within(row).getByPlaceholderText('Busque um produto...'), {
    target: { value: name },
  });
  fireEvent.mouseDown(screen.getByText(new RegExp(name)));
};

describe('OrderSimulatorModal', () => {
  it('starts closed and shows the empty state with zeroed totals when opened', () => {
    render(<Harness />);

    expect(screen.queryByTestId('simulator-modal')).not.toBeInTheDocument();

    openSimulator();

    expect(screen.getByText('Simulador de Pedido')).toBeInTheDocument();
    expect(screen.getByTestId('simulator-empty')).toBeInTheDocument();
    expect(screen.getByTestId('simulator-total-pv')).toHaveTextContent('0,00');
    expect(screen.getByTestId('simulator-total-member')).toHaveTextContent(
      /R\$\s*0,00/,
    );
    expect(screen.getByTestId('simulator-clear')).toBeDisabled();
  });

  it('adds a row and reveals its editable columns', () => {
    render(<Harness />);
    openSimulator();

    addRow();

    expect(screen.getByTestId('simulator-row-0')).toBeInTheDocument();
    expect(screen.queryByTestId('simulator-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('simulator-quantity-0')).toHaveValue(1);
    expect(screen.getByTestId('simulator-pv-unit-0')).toHaveTextContent('—');
    expect(screen.getByTestId('simulator-member-unit-0')).toHaveTextContent(
      '—',
    );
  });

  it('fills the unit and total columns after selecting a product', () => {
    render(<Harness />);
    openSimulator();
    addRow();

    selectProduct(0, 'Adaptiv Pastilhas');

    expect(screen.getByTestId('simulator-pv-unit-0')).toHaveTextContent(
      '31,00',
    );
    expect(screen.getByTestId('simulator-pv-total-0')).toHaveTextContent(
      '31,00',
    );
    expect(screen.getByTestId('simulator-member-unit-0')).toHaveTextContent(
      /R\$\s*231,25/,
    );
    expect(screen.getByTestId('simulator-member-total-0')).toHaveTextContent(
      /R\$\s*231,25/,
    );
  });

  it('recomputes the line and footer totals when the quantity changes', () => {
    render(<Harness />);
    openSimulator();
    addRow();
    selectProduct(0, 'Adaptiv Pastilhas');

    fireEvent.change(screen.getByTestId('simulator-quantity-0'), {
      target: { value: '3' },
    });

    expect(screen.getByTestId('simulator-pv-total-0')).toHaveTextContent(
      '93,00',
    );
    expect(screen.getByTestId('simulator-member-total-0')).toHaveTextContent(
      /R\$\s*693,75/,
    );
    expect(screen.getByTestId('simulator-total-pv')).toHaveTextContent('93,00');
    expect(screen.getByTestId('simulator-total-member')).toHaveTextContent(
      /R\$\s*693,75/,
    );
  });

  it('sums independent rows, including duplicate products', () => {
    render(<Harness />);
    openSimulator();

    addRow();
    selectProduct(0, 'Adaptiv Pastilhas');
    addRow();
    selectProduct(1, 'Adaptiv Pastilhas');
    fireEvent.change(screen.getByTestId('simulator-quantity-1'), {
      target: { value: '2' },
    });

    expect(screen.getByTestId('simulator-total-pv')).toHaveTextContent('93,00');
    expect(screen.getByTestId('simulator-total-member')).toHaveTextContent(
      /R\$\s*693,75/,
    );
  });

  it('recomputes the totals after removing a row', () => {
    render(<Harness />);
    openSimulator();

    addRow();
    selectProduct(0, 'Adaptiv Pastilhas');
    addRow();
    selectProduct(1, 'Óleo de Lavanda');

    expect(screen.getByTestId('simulator-total-pv')).toHaveTextContent('61,00');

    fireEvent.click(screen.getByTestId('simulator-remove-1'));

    expect(screen.queryByTestId('simulator-row-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('simulator-total-pv')).toHaveTextContent('31,00');
    expect(screen.getByTestId('simulator-total-member')).toHaveTextContent(
      /R\$\s*231,25/,
    );
  });

  it('clears every row but keeps the simulator open', () => {
    render(<Harness />);
    openSimulator();
    addRow();
    selectProduct(0, 'Adaptiv Pastilhas');

    fireEvent.click(screen.getByTestId('simulator-clear'));

    expect(screen.getByTestId('simulator-empty')).toBeInTheDocument();
    expect(screen.getByTestId('simulator-total-pv')).toHaveTextContent('0,00');
    expect(screen.getByText('Simulador de Pedido')).toBeInTheDocument();
  });

  it('discards the rows when closed and reopened', () => {
    render(<Harness />);
    openSimulator();
    addRow();
    selectProduct(0, 'Adaptiv Pastilhas');

    fireEvent.click(screen.getByTestId('simulator-close'));
    expect(screen.queryByTestId('simulator-modal')).not.toBeInTheDocument();

    openSimulator();
    expect(screen.getByTestId('simulator-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('simulator-row-0')).not.toBeInTheDocument();
  });
});
