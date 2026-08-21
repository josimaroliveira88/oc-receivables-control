import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StockPage from '../src/pages/StockPage';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

const mockInventoryItem = {
  productId: '11111111-1111-1111-1111-111111111111',
  code: '60226006',
  name: 'Adaptiv® Pastilhas',
  size: '60 pastilhas',
  quantity: 12,
};

const mockSecondInventoryItem = {
  productId: '22222222-2222-2222-2222-222222222222',
  code: '60215485',
  name: 'Basil',
  size: '5 ml',
  quantity: 3,
};

const mockNotInStockProduct = {
  id: '33333333-3333-3333-3333-333333333333',
  code: '60230001',
  name: 'Deep Blue',
  size: '10 ml',
};

const mockMovement = (overrides = {}) => ({
  id: 'movement-1',
  userId: 'user-1',
  productId: '11111111-1111-1111-1111-111111111111',
  quantity: 5,
  type: 'ENTRADA',
  reason: 'Compra inicial',
  createdAt: '2026-08-20T14:30:00.000Z',
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <StockPage />
      </ToastProvider>
    </MemoryRouter>,
  );

const openStockActionsMenu = async (productId) => {
  await waitFor(() => {
    expect(
      screen.getByTestId(`stock-actions-${productId}-trigger`),
    ).toBeInTheDocument();
  });
  fireEvent.click(screen.getByTestId(`stock-actions-${productId}-trigger`));
  await waitFor(() => {
    expect(
      screen.getByTestId(`stock-actions-${productId}-menu`),
    ).toBeInTheDocument();
  });
};

const clickStockAction = async (productId, label) => {
  await openStockActionsMenu(productId);
  fireEvent.click(
    screen.getByTestId(`stock-actions-${productId}-item-${label}`),
  );
};

describe('StockPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the page title "Controle de Estoque"', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Controle de Estoque')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching inventory', () => {
      mockGet.mockImplementation(() => new Promise(() => {}));
      renderPage();
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });

    it('should show error state when inventory fetch fails', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));
      renderPage();

      await waitFor(() => {
        expect(
          screen.getByText('Erro ao carregar estoque. Tente novamente.'),
        ).toBeInTheDocument();
      });
    });

    it('should show empty state when the user has no stock entries', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        expect(
          screen.getByText('Nenhum produto em estoque'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Inventory list', () => {
    it('should render a table with code, name and quantity from the API', async () => {
      mockGet.mockResolvedValue({ data: [mockInventoryItem] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('60226006')).toBeInTheDocument();
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
        expect(screen.getByText('60 pastilhas')).toBeInTheDocument();
        expect(screen.getByText('12')).toBeInTheDocument();
      });
    });

    it('should display multiple rows when the API returns several items', async () => {
      mockGet.mockResolvedValue({
        data: [mockInventoryItem, mockSecondInventoryItem],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
        expect(screen.getByText('Basil')).toBeInTheDocument();
      });
      expect(screen.getAllByRole('row')).toHaveLength(3);
    });

    it('should display the count of items in the inventory', async () => {
      mockGet.mockResolvedValue({
        data: [mockInventoryItem, mockSecondInventoryItem],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('2 produtos')).toBeInTheDocument();
      });
    });

    it('should call GET /api/stock on mount', async () => {
      mockGet.mockResolvedValue({ data: [mockInventoryItem] });
      renderPage();

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/stock');
      });
    });
  });

  describe('ActionMenu (kebab)', () => {
    it('should render one kebab trigger per row', async () => {
      mockGet.mockResolvedValue({
        data: [mockInventoryItem, mockSecondInventoryItem],
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId(/stock-actions-.*-trigger/)).toHaveLength(
          2,
        );
      });
    });

    it('should keep the menu hidden until the trigger is clicked', async () => {
      mockGet.mockResolvedValue({ data: [mockInventoryItem] });
      renderPage();

      await waitFor(() => {
        expect(
          screen.getByTestId(
            'stock-actions-11111111-1111-1111-1111-111111111111-trigger',
          ),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId(
          'stock-actions-11111111-1111-1111-1111-111111111111-menu',
        ),
      ).not.toBeInTheDocument();
    });

    it('should expose "Nova Entrada", "Nova Saída" and "Ver Histórico" items', async () => {
      mockGet.mockResolvedValue({ data: [mockInventoryItem] });
      renderPage();

      await openStockActionsMenu('11111111-1111-1111-1111-111111111111');

      expect(
        screen.getByTestId(
          'stock-actions-11111111-1111-1111-1111-111111111111-item-Nova-Entrada',
        ),
      ).toHaveTextContent('Nova Entrada');
      expect(
        screen.getByTestId(
          'stock-actions-11111111-1111-1111-1111-111111111111-item-Nova-Saida',
        ),
      ).toHaveTextContent('Nova Saída');
      expect(
        screen.getByTestId(
          'stock-actions-11111111-1111-1111-1111-111111111111-item-Ver-Historico',
        ),
      ).toHaveTextContent('Ver Histórico');
    });

    it('should close the menu when the backdrop is clicked', async () => {
      mockGet.mockResolvedValue({ data: [mockInventoryItem] });
      renderPage();

      await openStockActionsMenu('11111111-1111-1111-1111-111111111111');

      fireEvent.click(
        screen.getByTestId(
          'stock-actions-11111111-1111-1111-1111-111111111111-backdrop',
        ),
      );

      await waitFor(() => {
        expect(
          screen.queryByTestId(
            'stock-actions-11111111-1111-1111-1111-111111111111-menu',
          ),
        ).not.toBeInTheDocument();
      });
    });

    it('should expose correct a11y semantics on trigger, menu and items', async () => {
      mockGet.mockResolvedValue({ data: [mockInventoryItem] });
      renderPage();

      const trigger = await screen.findByTestId(
        'stock-actions-11111111-1111-1111-1111-111111111111-trigger',
      );
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await openStockActionsMenu('11111111-1111-1111-1111-111111111111');

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(
        screen.getByTestId(
          'stock-actions-11111111-1111-1111-1111-111111111111-menu',
        ),
      ).toHaveAttribute('role', 'menu');
      expect(
        screen.getByTestId(
          'stock-actions-11111111-1111-1111-1111-111111111111-item-Nova-Entrada',
        ),
      ).toHaveAttribute('role', 'menuitem');
    });
  });

  describe('MovementDialog', () => {
    it('should open with type "Entrada" pre-selected when clicking "Nova Entrada"', async () => {
      mockGet.mockResolvedValue({ data: [mockInventoryItem] });
      renderPage();

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Nova-Entrada',
      );

      const select = await screen.findByLabelText('Tipo');
      expect(select.value).toBe('ENTRADA');
      expect(screen.getByText('Nova Movimentação')).toBeInTheDocument();
    });

    it('should open with type "Saída" pre-selected when clicking "Nova Saída"', async () => {
      mockGet.mockResolvedValue({ data: [mockInventoryItem] });
      renderPage();

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Nova-Saida',
      );

      const select = await screen.findByLabelText('Tipo');
      expect(select.value).toBe('SAIDA');
    });

    it('should show validation error when submitting an empty quantity (ENTRADA)', async () => {
      mockGet.mockResolvedValue({ data: [mockInventoryItem] });
      renderPage();

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Nova-Entrada',
      );

      const quantityInput = await screen.findByLabelText('Quantidade');
      const form = quantityInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText('Quantidade é obrigatória'),
        ).toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should show validation error when quantity is zero for ENTRADA', async () => {
      mockGet.mockResolvedValue({ data: [mockInventoryItem] });
      renderPage();

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Nova-Entrada',
      );

      const quantityInput = await screen.findByLabelText('Quantidade');
      fireEvent.change(quantityInput, { target: { value: '0' } });

      const form = quantityInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText('Quantidade deve ser maior que zero'),
        ).toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should allow zero quantity for AJUSTE (saldo-alvo)', async () => {
      mockPost.mockResolvedValue({
        data: {
          movement: mockMovement({
            type: 'AJUSTE',
            quantity: -12,
          }),
          inventory: { productId: mockInventoryItem.productId, quantity: 0 },
        },
      });
      mockGet.mockResolvedValue({ data: [mockInventoryItem] });
      renderPage();

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Nova-Entrada',
      );

      const typeSelect = await screen.findByLabelText('Tipo');
      fireEvent.change(typeSelect, { target: { value: 'AJUSTE' } });

      const quantityInput = screen.getByLabelText('Quantidade');
      fireEvent.change(quantityInput, { target: { value: '0' } });

      const reasonInput = screen.getByLabelText('Motivo');
      fireEvent.change(reasonInput, { target: { value: 'Contagem' } });

      const form = quantityInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/stock/movements', {
          productId: mockInventoryItem.productId,
          type: 'AJUSTE',
          quantity: 0,
          reason: 'Contagem',
        });
      });
    });

    it('should POST to /api/stock/movements, show success toast, close and reload the inventory', async () => {
      mockPost.mockResolvedValue({
        data: {
          movement: mockMovement(),
          inventory: { productId: mockInventoryItem.productId, quantity: 17 },
        },
      });
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({
          data: [{ ...mockInventoryItem, quantity: 17 }],
        });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Nova-Entrada',
      );

      const quantityInput = await screen.findByLabelText('Quantidade');
      fireEvent.change(quantityInput, { target: { value: '5' } });

      const reasonInput = screen.getByLabelText('Motivo');
      fireEvent.change(reasonInput, { target: { value: 'Compra inicial' } });

      const form = quantityInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/stock/movements', {
          productId: mockInventoryItem.productId,
          type: 'ENTRADA',
          quantity: 5,
          reason: 'Compra inicial',
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText('Movimentação registrada com sucesso!'),
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.queryByText('Nova Movimentação')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(2);
        expect(mockGet).toHaveBeenNthCalledWith(2, '/stock');
      });
    });

    it('should show an error toast and keep the dialog open when the POST fails', async () => {
      mockGet.mockResolvedValue({ data: [mockInventoryItem] });
      mockPost.mockRejectedValue(new Error('Server error'));

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Nova-Entrada',
      );

      const quantityInput = await screen.findByLabelText('Quantidade');
      fireEvent.change(quantityInput, { target: { value: '5' } });

      const form = quantityInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText('Erro ao registrar movimentação. Tente novamente.'),
        ).toBeInTheDocument();
      });
      expect(screen.getByText('Nova Movimentação')).toBeInTheDocument();
    });
  });

  describe('HistoryDialog', () => {
    it('should open the history dialog when clicking "Ver Histórico"', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({
          data: [
            mockMovement(),
            mockMovement({
              id: 'movement-2',
              quantity: -2,
              type: 'SAIDA',
              reason: 'Uso pessoal',
              createdAt: '2026-08-21T09:00:00.000Z',
            }),
          ],
        });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(screen.getByText('Histórico de Estoque')).toBeInTheDocument();
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });
    });

    it('should fetch history from the API for the selected product', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({ data: [mockMovement()] });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith(
          `/stock/${mockInventoryItem.productId}/history`,
        );
      });
    });

    it('should display movement rows with type badge, signed quantity and reason', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({
          data: [
            mockMovement(),
            mockMovement({
              id: 'movement-2',
              quantity: -2,
              type: 'SAIDA',
              reason: 'Uso pessoal',
              createdAt: '2026-08-21T09:00:00.000Z',
            }),
          ],
        });

      renderPage();

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(screen.getByTestId('movement-type-ENTRADA')).toBeInTheDocument();
        expect(screen.getByTestId('movement-type-SAIDA')).toBeInTheDocument();
      });

      expect(screen.getByText('+5')).toBeInTheDocument();
      expect(screen.getByText('-2')).toBeInTheDocument();
      expect(screen.getByText('Compra inicial')).toBeInTheDocument();
      expect(screen.getByText('Uso pessoal')).toBeInTheDocument();
    });

    it('should show an empty state when the product has no movements yet', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({ data: [] });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            'Nenhuma movimentação registrada para este produto.',
          ),
        ).toBeInTheDocument();
      });
    });

    it('should show loading state inside the history dialog while fetching', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockImplementationOnce(() => new Promise(() => {}));

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      expect(screen.getByText('Carregando histórico...')).toBeInTheDocument();
    });
  });

  describe('Adicionar Estoque', () => {
    it('should render the "Adicionar Estoque" button in the page header', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adicionar Estoque')).toBeInTheDocument();
      });
    });

    it('should open the dialog with a product combobox and type ENTRADA pre-selected when clicking "Adicionar Estoque"', async () => {
      mockGet.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({
        data: { data: [mockNotInStockProduct] },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adicionar Estoque')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Adicionar Estoque'));

      await waitFor(() => {
        expect(screen.getByText('Nova Movimentação')).toBeInTheDocument();
      });
      expect(
        screen.getByPlaceholderText('Busque um produto...'),
      ).toBeInTheDocument();

      const typeSelect = screen.getByLabelText('Tipo');
      expect(typeSelect.value).toBe('ENTRADA');
    });

    it('should show "Produto é obrigatório" when submitting without selecting a product', async () => {
      mockGet.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({
        data: { data: [mockNotInStockProduct] },
      });

      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Adicionar Estoque'));
      });

      const quantityInput = await screen.findByLabelText('Quantidade');
      fireEvent.change(quantityInput, { target: { value: '5' } });

      const form = quantityInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Produto é obrigatório')).toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should POST the movement, show success toast, close the dialog and reload the inventory when a product is selected', async () => {
      mockPost.mockResolvedValue({
        data: {
          movement: mockMovement({ productId: mockNotInStockProduct.id }),
          inventory: {
            productId: mockNotInStockProduct.id,
            quantity: 5,
          },
        },
      });
      mockGet
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({
          data: { data: [mockNotInStockProduct] },
        })
        .mockResolvedValueOnce({
          data: [
            mockInventoryItem,
            {
              productId: mockNotInStockProduct.id,
              code: mockNotInStockProduct.code,
              name: mockNotInStockProduct.name,
              size: mockNotInStockProduct.size,
              quantity: 5,
            },
          ],
        });

      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Adicionar Estoque'));
      });

      const combobox = await screen.findByPlaceholderText(
        'Busque um produto...',
      );
      fireEvent.change(combobox, {
        target: { value: mockNotInStockProduct.name },
      });

      const option = await screen.findByText(mockNotInStockProduct.name);
      fireEvent.mouseDown(option);

      const quantityInput = screen.getByLabelText('Quantidade');
      fireEvent.change(quantityInput, { target: { value: '5' } });

      const reasonInput = screen.getByLabelText('Motivo');
      fireEvent.change(reasonInput, { target: { value: 'Estoque inicial' } });

      const form = quantityInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/stock/movements', {
          productId: mockNotInStockProduct.id,
          type: 'ENTRADA',
          quantity: 5,
          reason: 'Estoque inicial',
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText('Movimentação registrada com sucesso!'),
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.queryByText('Nova Movimentação')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(3);
        expect(mockGet).toHaveBeenNthCalledWith(3, '/stock');
      });
    });

    it('should not list products already in stock in the available products combobox', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({
          data: {
            data: [
              {
                id: mockInventoryItem.productId,
                code: mockInventoryItem.code,
                name: mockInventoryItem.name,
                size: mockInventoryItem.size,
              },
              mockNotInStockProduct,
            ],
          },
        });

      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Adicionar Estoque'));
      });

      const combobox = await screen.findByPlaceholderText(
        'Busque um produto...',
      );

      fireEvent.change(combobox, {
        target: { value: mockNotInStockProduct.name },
      });
      await waitFor(() => {
        expect(
          screen.getByText(mockNotInStockProduct.name),
        ).toBeInTheDocument();
      });

      fireEvent.change(combobox, { target: { value: 'Adaptiv' } });
      await waitFor(() => {
        expect(
          screen.getByText('Nenhum produto encontrado'),
        ).toBeInTheDocument();
      });
    });

    it('should initialize a product with AJUSTE to set an absolute balance', async () => {
      mockPost.mockResolvedValue({
        data: {
          movement: mockMovement({
            type: 'AJUSTE',
            quantity: 10,
            productId: mockNotInStockProduct.id,
          }),
          inventory: {
            productId: mockNotInStockProduct.id,
            quantity: 10,
          },
        },
      });
      mockGet
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({
          data: { data: [mockNotInStockProduct] },
        })
        .mockResolvedValueOnce({ data: [] });

      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Adicionar Estoque'));
      });

      const combobox = await screen.findByPlaceholderText(
        'Busque um produto...',
      );
      fireEvent.change(combobox, {
        target: { value: mockNotInStockProduct.name },
      });
      const option = await screen.findByText(mockNotInStockProduct.name);
      fireEvent.mouseDown(option);

      const typeSelect = screen.getByLabelText('Tipo');
      fireEvent.change(typeSelect, { target: { value: 'AJUSTE' } });

      const quantityInput = screen.getByLabelText('Quantidade');
      fireEvent.change(quantityInput, { target: { value: '10' } });

      const form = quantityInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/stock/movements', {
          productId: mockNotInStockProduct.id,
          type: 'AJUSTE',
          quantity: 10,
        });
      });
    });
  });

  describe('Undo last movement', () => {
    it('should render "Desfazer última movimentação" in the history dialog when there are movements', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({ data: [mockMovement()] });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(screen.getByTestId('undo-last-movement')).toBeInTheDocument();
      });
    });

    it('should NOT render the undo button when the product has no movements', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({ data: [] });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            'Nenhuma movimentação registrada para este produto.',
          ),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId('undo-last-movement'),
      ).not.toBeInTheDocument();
    });

    it('should open a confirmation dialog with the product name when clicking the undo button', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({ data: [mockMovement()] });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(screen.getByTestId('undo-last-movement')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('undo-last-movement'));

      const dialog = await screen.findByRole('dialog');
      expect(
        within(dialog).getByText('Desfazer última movimentação'),
      ).toBeInTheDocument();
      expect(within(dialog).getByText(/Adaptiv/)).toBeInTheDocument();
      expect(
        within(dialog).getByRole('button', { name: 'Desfazer' }),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole('button', { name: 'Cancelar' }),
      ).toBeInTheDocument();
    });

    it('should NOT call the undo API when the confirmation is cancelled', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({ data: [mockMovement()] });

      renderPage();

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(screen.getByTestId('undo-last-movement')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('undo-last-movement'));

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should call POST undo, show success toast, reload history and inventory when confirmed', async () => {
      mockPost.mockResolvedValue({
        data: {
          movement: mockMovement(),
          inventory: {
            productId: mockInventoryItem.productId,
            quantity: 7,
          },
        },
      });
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({
          data: [
            mockMovement(),
            mockMovement({
              id: 'movement-2',
              quantity: -2,
              type: 'SAIDA',
              reason: 'Uso pessoal',
              createdAt: '2026-08-21T09:00:00.000Z',
            }),
          ],
        })
        .mockResolvedValueOnce({
          data: [mockMovement()],
        })
        .mockResolvedValueOnce({
          data: [{ ...mockInventoryItem, quantity: 7 }],
        });

      renderPage();

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(screen.getByTestId('undo-last-movement')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('undo-last-movement'));

      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer' }));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/stock/movements/movement-1/undo',
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText('Última movimentação desfeita com sucesso!'),
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(4);
        expect(mockGet).toHaveBeenNthCalledWith(
          3,
          `/stock/${mockInventoryItem.productId}/history`,
        );
        expect(mockGet).toHaveBeenNthCalledWith(4, '/stock');
      });
    });

    it('should keep the undo button available for the new last movement after a sequential undo', async () => {
      mockPost.mockResolvedValue({
        data: {
          movement: mockMovement(),
          inventory: {
            productId: mockInventoryItem.productId,
            quantity: 5,
          },
        },
      });
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({
          data: [
            mockMovement(),
            mockMovement({ id: 'movement-first', quantity: 5 }),
          ],
        })
        .mockResolvedValueOnce({ data: [mockMovement()] })
        .mockResolvedValueOnce({
          data: [{ ...mockInventoryItem, quantity: 5 }],
        });

      renderPage();

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(screen.getByTestId('undo-last-movement')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('undo-last-movement'));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer' }));

      await waitFor(() => {
        expect(
          screen.getByText('Última movimentação desfeita com sucesso!'),
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('undo-last-movement')).toBeInTheDocument();
      });
    });

    it('should remove the product from the inventory and hide the undo button when undoing the only movement', async () => {
      mockPost.mockResolvedValue({
        data: {
          movement: mockMovement(),
          inventory: null,
        },
      });
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({ data: [mockMovement()] })
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({ data: [] });

      renderPage();

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(screen.getByTestId('undo-last-movement')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('undo-last-movement'));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer' }));

      await waitFor(() => {
        expect(
          screen.getByText('Última movimentação desfeita com sucesso!'),
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId('undo-last-movement'),
        ).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(
          screen.getByText('Nenhum produto em estoque'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Order-locked last movement', () => {
    const orderMovement = mockMovement({
      type: 'ENTRADA',
      reason: 'Pedido ORD-42',
      orderId: 'order-1',
      order: { id: 'order-1', orderNumber: 'ORD-42' },
    });

    it('should NOT show the undo button when the latest movement is linked to an order', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({ data: [orderMovement] });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('history-order-locked-notice'),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId('undo-last-movement'),
      ).not.toBeInTheDocument();
    });

    it('should show the order number and a "Ver pedido" button in the locked notice', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({ data: [orderMovement] });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(
          screen.getByText(/vinculada ao Pedido #ORD-42/),
        ).toBeInTheDocument();
      });
      const goButton = screen.getByTestId('go-to-order-from-history');
      expect(goButton).toBeInTheDocument();
      expect(goButton.textContent).toMatch(/Ver pedido/);
    });

    it('should display a "Pedido #X" badge on movement rows linked to an order', async () => {
      mockGet
        .mockResolvedValueOnce({ data: [mockInventoryItem] })
        .mockResolvedValueOnce({ data: [orderMovement] });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickStockAction(
        '11111111-1111-1111-1111-111111111111',
        'Ver-Historico',
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('movement-order-ENTRADA'),
        ).toBeInTheDocument();
      });
      expect(screen.getByTestId('movement-order-ENTRADA')).toHaveTextContent(
        'Pedido #ORD-42',
      );
    });
  });
});
