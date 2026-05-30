import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrdersPage from '../src/pages/OrdersPage';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

const mockOrders = [
  {
    id: '1',
    orderNumber: 'ORD-001',
    totalValue: '300.00',
    status: 'PENDENTE',
    items: [
      { id: 'i1', description: 'Item 1', value: '100.00', personId: 'p1', person: { name: 'João' } },
      { id: 'i2', description: 'Item 2', value: '200.00', personId: 'p1', person: { name: 'João' } },
    ],
  },
  {
    id: '2',
    orderNumber: 'ORD-002',
    totalValue: '500.00',
    status: 'QUITADO',
    items: [
      { id: 'i3', description: 'Item 3', value: '500.00', personId: 'p2', person: { name: 'Maria' } },
    ],
  },
];

const mockPeople = [
  { id: 'p1', name: 'João Silva', contact: 'joao@email.com' },
  { id: 'p2', name: 'Maria Santos', contact: 'maria@email.com' },
];

const mockGetImplementation = (ordersData = [], peopleData = mockPeople) => {
  mockGet.mockImplementation((url) => {
    if (url === '/orders') return Promise.resolve({ data: ordersData });
    if (url === '/people') return Promise.resolve({ data: peopleData });
    return Promise.resolve({ data: [] });
  });
};

const renderPage = () => {
  return render(
    <MemoryRouter>
      <OrdersPage />
    </MemoryRouter>
  );
};

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the page title "Gestão de Pedidos"', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Gestão de Pedidos')).toBeInTheDocument();
      });
    });

    it('should render "Novo Pedido" button', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });
    });

    it('should show empty state when no orders exist', async () => {
      mockGetImplementation([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nenhum pedido cadastrado')).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      mockGet.mockImplementation(() => new Promise(() => {}));
      renderPage();
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });
  });

  describe('Orders List', () => {
    beforeEach(() => {
      mockGetImplementation(mockOrders);
    });

    it('should display orders in a table', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
        expect(screen.getByText('ORD-002')).toBeInTheDocument();
      });
    });

    it('should display order total values', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('R$ 300.00')).toBeInTheDocument();
        expect(screen.getByText('R$ 500.00')).toBeInTheDocument();
      });
    });

    it('should display status badges', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Pendente')).toBeInTheDocument();
        expect(screen.getByText('Quitado')).toBeInTheDocument();
      });
    });

    it('should display Edit and Delete buttons for each order', async () => {
      renderPage();
      await waitFor(() => {
        const editButtons = screen.getAllByText('Editar');
        const deleteButtons = screen.getAllByText('Excluir');
        expect(editButtons).toHaveLength(2);
        expect(deleteButtons).toHaveLength(2);
      });
    });
  });

  describe('Create Order Modal', () => {
    beforeEach(() => {
      mockGetImplementation([]);
    });

    it('should open create modal when clicking "Novo Pedido"', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByText('Itens do Pedido')).toBeInTheDocument();
      });
    });

    it('should display "Adicionar Item" button in the modal', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByText('Adicionar Item')).toBeInTheDocument();
      });
    });

    it('should add a new item row when clicking "Adicionar Item"', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByText('Adicionar Item')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Adicionar Item'));

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2')).toBeInTheDocument();
      });
    });

    it('should remove an item row when clicking "Remover"', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByText('Adicionar Item')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Adicionar Item'));

      await waitFor(() => {
        const removeButtons = screen.getAllByText('Remover');
        expect(removeButtons).toHaveLength(2);
      });

      const removeButtons = screen.getAllByText('Remover');
      fireEvent.click(removeButtons[1]);

      await waitFor(() => {
        expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
      });
    });

    it('should display person dropdown in item row', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByText('Selecione uma pessoa')).toBeInTheDocument();
      });
    });

    it('should show validation error when submitting incomplete form', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Digite o número do pedido')).toBeInTheDocument();
      });

      const form = screen.getByPlaceholderText('Digite o número do pedido').closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Número do pedido é obrigatório')).toBeInTheDocument();
      });
    });

    it('should close modal when clicking "Cancelar"', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo Pedido')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo Pedido'));

      await waitFor(() => {
        expect(screen.getByText('Cancelar')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancelar'));

      await waitFor(() => {
        expect(screen.queryByText('Cancelar')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edit Order', () => {
    beforeEach(() => {
      mockGetImplementation(mockOrders);
    });

    it('should open edit modal with pre-filled data', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('Editar');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Editar Pedido')).toBeInTheDocument();
        expect(screen.getByDisplayValue('ORD-001')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Order', () => {
    beforeEach(() => {
      mockGetImplementation(mockOrders);
    });

    it('should call delete API when confirming deletion', async () => {
      mockDelete.mockResolvedValue({ data: { message: 'Order deleted successfully' } });
      window.confirm = vi.fn(() => true);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('Excluir');
      fireEvent.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalled();
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('/orders/1');
      });
    });

    it('should not delete when user cancels', async () => {
      window.confirm = vi.fn(() => false);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('ORD-001')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('Excluir');
      fireEvent.click(deleteButtons[0]);

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
