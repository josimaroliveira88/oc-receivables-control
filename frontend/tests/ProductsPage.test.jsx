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
import ProductsPage from '../src/pages/ProductsPage';
import { ToastProvider } from '../src/components/Toast';

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

class MockIntersectionObserver {
  static callback = null;
  static node = null;
  constructor(callback) {
    MockIntersectionObserver.callback = callback;
  }
  observe(node) {
    MockIntersectionObserver.node = node;
  }
  unobserve() {}
  disconnect() {
    MockIntersectionObserver.callback = null;
    MockIntersectionObserver.node = null;
  }
  static trigger(entry) {
    if (
      MockIntersectionObserver.callback &&
      MockIntersectionObserver.node?.isConnected
    ) {
      MockIntersectionObserver.callback([entry]);
    }
  }
}

const mockProduct = {
  id: '1',
  code: '60226006',
  name: 'Adaptiv® Pastilhas',
  size: '60 pastilhas',
  status: 'ATIVO',
  regularPrice: 308.0,
  memberPrice: 231.25,
  pv: 31,
  pricePerPv: '7.46',
  doterraUrl: null,
};

const mockInactiveProduct = {
  id: '2',
  code: '60215485',
  name: 'Basil',
  size: '5 ml',
  status: 'INATIVO',
  regularPrice: 103.0,
  memberPrice: 77.5,
  pv: 9,
  pricePerPv: '8.61',
  doterraUrl: null,
};

const mockUnavailableProduct = {
  id: '3',
  code: '60230001',
  name: 'Deep Blue',
  size: '10 ml',
  status: 'INDISPONIVEL',
  regularPrice: 150.0,
  memberPrice: 112.5,
  pv: 15,
  pricePerPv: '7.50',
  doterraUrl: 'https://www.doterra.com/BR/pt_BR/p/deep-blue',
};

const mockHighPvProduct = {
  id: '4',
  code: '60239004',
  name: 'Óleo Intenso',
  size: '15 ml',
  status: 'ATIVO',
  regularPrice: 250.0,
  memberPrice: 187.5,
  pv: 60,
  pricePerPv: '3.13',
  doterraUrl: null,
};

const fullResponse = (data) => ({
  data,
  pagination: {
    page: 1,
    pageSize: Math.max(data.length, 1),
    total: data.length,
    totalPages: 1,
    hasMore: false,
  },
});

const manyProducts = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1),
  code: `PROD${String(i + 1).padStart(4, '0')}`,
  name: `Produto ${i + 1}`,
  size: '15 ml',
  status: 'ATIVO',
  regularPrice: 100 + i,
  memberPrice: 75 + i,
  pv: 5 + i,
  pricePerPv: ((75 + i) / (5 + i)).toFixed(2),
  doterraUrl: null,
}));

const renderPage = () => {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ProductsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
};

const openProductActionsMenu = async (productId) => {
  await waitFor(() => {
    expect(
      screen.getByTestId(`product-actions-${productId}-trigger`),
    ).toBeInTheDocument();
  });
  fireEvent.click(screen.getByTestId(`product-actions-${productId}-trigger`));
  await waitFor(() => {
    expect(
      screen.getByTestId(`product-actions-${productId}-menu`),
    ).toBeInTheDocument();
  });
};

const clickProductAction = async (productId, label) => {
  await openProductActionsMenu(productId);
  fireEvent.click(
    screen.getByTestId(`product-actions-${productId}-item-${label}`),
  );
};

const rowNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('td[data-label="Produto"]').textContent);

const togglePointsColumn = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Pontos' }));
};

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.IntersectionObserver = MockIntersectionObserver;
    MockIntersectionObserver.callback = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  describe('Rendering', () => {
    it('should render "Cadastro de Produtos"', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Cadastro de Produtos')).toBeInTheDocument();
      });
    });

    it('should render "Novo" button, search input and filter selects', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Novo')).toBeInTheDocument();
        expect(
          screen.getByPlaceholderText('Buscar por nome ou código...'),
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Ordenar por')).toBeInTheDocument();
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Pontos' }),
        ).toBeInTheDocument();
        expect(screen.queryByLabelText('Regularidade')).not.toBeInTheDocument();
      });
    });

    it('should show empty state when no products exist', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByText('Nenhum produto cadastrado'),
        ).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      mockGet.mockImplementation(() => new Promise(() => {}));
      renderPage();
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });
  });

  describe('Products List', () => {
    it('should display products in a table', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('60226006')).toBeInTheDocument();
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
        expect(screen.getByText('60 pastilhas')).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*308,00/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*231,25/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*7,46/)).toBeInTheDocument();
      });
    });

    it('should display a placeholder when R$/PV is unavailable', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([{ ...mockProduct, pricePerPv: null }]),
      });
      renderPage();

      await waitFor(() => {
        const row = screen.getByText(mockProduct.name).closest('tr');
        expect(row.querySelector('[data-label="R$/PV"]')).toHaveTextContent(
          '—',
        );
      });
    });

    it('should display status badge for active, unavailable and inactive products', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([
          mockProduct,
          mockUnavailableProduct,
          mockInactiveProduct,
        ]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('product-status-ATIVO')).toBeInTheDocument();
        expect(
          screen.getByTestId('product-status-INDISPONIVEL'),
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('product-status-INATIVO'),
        ).toBeInTheDocument();
      });
    });

    it('should show the product count from the in-memory list', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockInactiveProduct]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('2 produtos')).toBeInTheDocument();
      });
    });
  });

  describe('Site column', () => {
    it('should render an external link when the product has a doterraUrl', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockUnavailableProduct]),
      });
      renderPage();

      await waitFor(() => {
        const link = screen.getByLabelText('Ver produto no site');
        expect(link).toHaveAttribute(
          'href',
          'https://www.doterra.com/BR/pt_BR/p/deep-blue',
        );
        expect(link).toHaveAttribute('target', '_blank');
      });
    });

    it('should render a placeholder when the product has no doterraUrl', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(
          screen.queryByLabelText('Ver produto no site'),
        ).not.toBeInTheDocument();
        const row = screen.getByText(mockProduct.name).closest('tr');
        expect(row.querySelector('[data-label="Site"]')).toHaveTextContent('—');
      });
    });
  });

  describe('Loyalty points column', () => {
    const pontosCellFor = (name) =>
      screen
        .getByText(name)
        .closest('tr')
        .querySelector('[data-label="Pontos"]');

    it('should hide the Pontos column, the Regularidade select and the explanatory text by default', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      expect(
        screen.queryByRole('columnheader', { name: 'Pontos' }),
      ).not.toBeInTheDocument();
      expect(pontosCellFor('Adaptiv® Pastilhas')).toBeNull();
      expect(screen.queryByLabelText('Regularidade')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Selecione sua regularidade de pedidos'),
      ).not.toBeInTheDocument();
    });

    it('should reveal the Pontos column and the Regularidade select when the button is clicked and hide them again', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      togglePointsColumn();
      await waitFor(() => {
        expect(
          screen.getByRole('columnheader', { name: 'Pontos' }),
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Regularidade')).toBeInTheDocument();
        expect(
          screen.getByText('Selecione sua regularidade de pedidos'),
        ).toBeInTheDocument();
      });

      togglePointsColumn();
      await waitFor(() => {
        expect(
          screen.queryByRole('columnheader', { name: 'Pontos' }),
        ).not.toBeInTheDocument();
        expect(pontosCellFor('Adaptiv® Pastilhas')).toBeNull();
        expect(screen.queryByLabelText('Regularidade')).not.toBeInTheDocument();
      });
    });

    it('should show a placeholder in the Pontos column when no tier is selected', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      togglePointsColumn();

      await waitFor(() => {
        expect(pontosCellFor('Adaptiv® Pastilhas')).toHaveTextContent('—');
      });
    });

    it('should render the Regularidade select and the explanatory text when the column is shown', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo')).toBeInTheDocument();
      });

      togglePointsColumn();

      await waitFor(() => {
        expect(screen.getByLabelText('Regularidade')).toBeInTheDocument();
        expect(
          screen.getByText('Selecione sua regularidade de pedidos'),
        ).toBeInTheDocument();
      });
    });

    it('should show 10% of PV when 1 to 3 months is selected', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockInactiveProduct]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      togglePointsColumn();
      await waitFor(() => {
        expect(screen.getByLabelText('Regularidade')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Regularidade'), {
        target: { value: '1-3' },
      });

      await waitFor(() => {
        expect(pontosCellFor('Adaptiv® Pastilhas')).toHaveTextContent('3,10');
        expect(pontosCellFor('Basil')).toHaveTextContent('0,90');
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should update the points when the tier changes to 13+ months', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      togglePointsColumn();
      await waitFor(() => {
        expect(screen.getByLabelText('Regularidade')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Regularidade'), {
        target: { value: '13+' },
      });

      await waitFor(() => {
        expect(pontosCellFor('Adaptiv® Pastilhas')).toHaveTextContent('9,30');
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should update the explanatory text when the tier changes', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo')).toBeInTheDocument();
      });

      togglePointsColumn();
      await waitFor(() => {
        expect(screen.getByLabelText('Regularidade')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Regularidade'), {
        target: { value: '4-6' },
      });

      await waitFor(() => {
        expect(
          screen.getByText('15% do PV nos meses 4–6 • mínimo 50 PV por pedido'),
        ).toBeInTheDocument();
      });
    });

    it('should highlight products below the 50 PV minimum', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockHighPvProduct]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      togglePointsColumn();
      await waitFor(() => {
        expect(screen.getByLabelText('Regularidade')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Regularidade'), {
        target: { value: '1-3' },
      });

      await waitFor(() => {
        const lowCell = pontosCellFor('Adaptiv® Pastilhas');
        const highCell = pontosCellFor('Óleo Intenso');
        expect(lowCell).toHaveClass('text-amber-600');
        expect(lowCell).toHaveAttribute(
          'title',
          'PV abaixo de 50: isoladamente este produto não acumula pontos',
        );
        expect(highCell).not.toHaveClass('text-amber-600');
        expect(highCell).not.toHaveAttribute('title');
      });
    });
  });

  describe('Client-side Search, Filter and Sort', () => {
    it('should filter the list by name without a new API call', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockInactiveProduct]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);

      fireEvent.change(
        screen.getByPlaceholderText('Buscar por nome ou código...'),
        {
          target: { value: 'Basil' },
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Basil')).toBeInTheDocument();
        expect(
          screen.queryByText('Adaptiv® Pastilhas'),
        ).not.toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should filter the list by code without a new API call', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockInactiveProduct]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText('Buscar por nome ou código...'),
        {
          target: { value: '60226006' },
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
        expect(screen.queryByText('Basil')).not.toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should filter the list by ATIVO status without a new API call', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockInactiveProduct]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: 'ATIVO' },
      });

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
        expect(screen.queryByText('Basil')).not.toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should filter the list by INATIVO status without a new API call', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockInactiveProduct]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: 'INATIVO' },
      });

      await waitFor(() => {
        expect(screen.getByText('Basil')).toBeInTheDocument();
        expect(
          screen.queryByText('Adaptiv® Pastilhas'),
        ).not.toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should filter the list by INDISPONIVEL status without a new API call', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([
          mockProduct,
          mockUnavailableProduct,
          mockInactiveProduct,
        ]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Deep Blue')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: 'INDISPONIVEL' },
      });

      await waitFor(() => {
        expect(screen.getByText('Deep Blue')).toBeInTheDocument();
        expect(
          screen.queryByText('Adaptiv® Pastilhas'),
        ).not.toBeInTheDocument();
        expect(screen.queryByText('Basil')).not.toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should sort the list by PV ascending without a new API call', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockInactiveProduct]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Ordenar por'), {
        target: { value: 'pv:asc' },
      });

      await waitFor(() => {
        expect(rowNames()).toEqual(['Basil', 'Adaptiv® Pastilhas']);
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should sort the list by name descending without a new API call', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockInactiveProduct]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Ordenar por'), {
        target: { value: 'name:desc' },
      });

      await waitFor(() => {
        expect(rowNames()).toEqual(['Basil', 'Adaptiv® Pastilhas']);
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should show filtered empty state when a filter yields no results', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockInactiveProduct]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo')).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText('Buscar por nome ou código...'),
        {
          target: { value: 'NãoExiste' },
        },
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            'Nenhum produto encontrado para os filtros aplicados.',
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Infinite Scroll (client-side)', () => {
    it('should reveal more products from the in-memory list when the sentinel becomes visible', async () => {
      mockGet.mockResolvedValue({ data: fullResponse(manyProducts) });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('25 produtos')).toBeInTheDocument();
      });
      expect(screen.getAllByRole('row')).toHaveLength(21);
      expect(mockGet).toHaveBeenCalledTimes(1);

      await act(async () => {
        MockIntersectionObserver.trigger({ isIntersecting: true });
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row')).toHaveLength(26);
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should not reveal more rows when the filtered list fits the page size', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockInactiveProduct]),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);

      await act(async () => {
        MockIntersectionObserver.trigger({ isIntersecting: true });
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row')).toHaveLength(3);
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should keep infinite scroll working after creating a product without refetching', async () => {
      const sixtyProducts = Array.from({ length: 60 }, (_, i) => ({
        id: String(i + 1),
        code: `PROD${String(i + 1).padStart(4, '0')}`,
        name: `Produto ${i + 1}`,
        size: '15 ml',
        status: 'ATIVO',
        regularPrice: 100 + i,
        memberPrice: 75 + i,
        pv: 5 + i,
        doterraUrl: null,
      }));
      mockGet.mockResolvedValue({ data: fullResponse(sixtyProducts) });
      mockPost.mockResolvedValue({ data: { ...mockProduct, id: '999' } });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('60 produtos')).toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('Novo'));

      const codeInput = await screen.findByPlaceholderText('Digite o código');
      fireEvent.change(codeInput, { target: { value: '60226006' } });
      fireEvent.change(
        screen.getByPlaceholderText('Digite o nome do produto'),
        { target: { value: 'Adaptiv® Pastilhas' } },
      );
      fireEvent.change(screen.getByPlaceholderText('Digite o tamanho'), {
        target: { value: '60 pastilhas' },
      });
      fireEvent.change(screen.getByPlaceholderText('Digite o preço regular'), {
        target: { value: '308.00' },
      });
      fireEvent.change(
        screen.getByPlaceholderText('Digite o preço de membro'),
        { target: { value: '231.25' } },
      );
      fireEvent.change(screen.getByPlaceholderText('Digite o PV'), {
        target: { value: '31' },
      });

      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row')).toHaveLength(21);
      });

      await act(async () => {
        MockIntersectionObserver.trigger({ isIntersecting: true });
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row')).toHaveLength(41);
      });
    });
  });

  describe('Create Product Modal', () => {
    it('should open modal when clicking "Novo"', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo'));

      await waitFor(() => {
        expect(screen.getByText('Novo Produto')).toBeInTheDocument();
      });
    });

    it('should show validation error when submitting empty code', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const form = (
        await screen.findByPlaceholderText('Digite o código')
      ).closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Código é obrigatório')).toBeInTheDocument();
      });
    });

    it('should render the form validation error inside the modal (not behind it)', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const form = (
        await screen.findByPlaceholderText('Digite o código')
      ).closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Código é obrigatório')).toBeInTheDocument();
      });

      const modal = document.querySelector('.fixed.inset-0.z-\\[60\\]');
      expect(modal).not.toBeNull();
      expect(
        within(modal).getByText('Código é obrigatório'),
      ).toBeInTheDocument();
    });

    it('should clear the validation error once a field is typed', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const codeInput = await screen.findByPlaceholderText('Digite o código');
      const form = codeInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Código é obrigatório')).toBeInTheDocument();
      });

      fireEvent.change(codeInput, { target: { value: 'ABC' } });

      expect(
        screen.queryByText('Código é obrigatório'),
      ).not.toBeInTheDocument();
    });

    it('should show backend submit failure as a toast', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      mockPost.mockRejectedValue({
        response: {
          data: { error: 'Erro ao criar produto. Tente novamente.' },
        },
      });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const codeInput = await screen.findByPlaceholderText('Digite o código');
      fireEvent.change(codeInput, { target: { value: 'ABC' } });
      fireEvent.change(
        screen.getByPlaceholderText('Digite o nome do produto'),
        {
          target: { value: 'Produto Teste' },
        },
      );
      fireEvent.change(screen.getByPlaceholderText('Digite o tamanho'), {
        target: { value: '10' },
      });
      fireEvent.change(screen.getByPlaceholderText('Digite o preço regular'), {
        target: { value: '10.00' },
      });
      fireEvent.change(
        screen.getByPlaceholderText('Digite o preço de membro'),
        { target: { value: '8.00' } },
      );
      fireEvent.change(screen.getByPlaceholderText('Digite o PV'), {
        target: { value: '1' },
      });
      fireEvent.change(
        screen.getByPlaceholderText('https://www.doterra.com/BR/pt_BR/...'),
        { target: { value: 'https://www.doterra.com/BR/pt_BR/p' } },
      );

      const form = codeInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText('Erro ao criar produto. Tente novamente.'),
        ).toBeInTheDocument();
      });
    });

    it('should show validation error when doterraUrl is invalid', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const codeInput = await screen.findByPlaceholderText('Digite o código');
      fireEvent.change(codeInput, { target: { value: '60226006' } });
      fireEvent.change(
        screen.getByPlaceholderText('Digite o nome do produto'),
        { target: { value: 'Adaptiv® Pastilhas' } },
      );
      fireEvent.change(screen.getByPlaceholderText('Digite o tamanho'), {
        target: { value: '60 pastilhas' },
      });
      fireEvent.change(screen.getByPlaceholderText('Digite o preço regular'), {
        target: { value: '308.00' },
      });
      fireEvent.change(
        screen.getByPlaceholderText('Digite o preço de membro'),
        { target: { value: '231.25' } },
      );
      fireEvent.change(screen.getByPlaceholderText('Digite o PV'), {
        target: { value: '31' },
      });
      fireEvent.change(
        screen.getByPlaceholderText('https://www.doterra.com/BR/pt_BR/...'),
        {
          target: { value: 'não é uma url' },
        },
      );

      const form = codeInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('URL do produto inválida')).toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should create product and call API', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      mockPost.mockResolvedValue({ data: { ...mockProduct } });

      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const codeInput = await screen.findByPlaceholderText('Digite o código');
      const nameInput = screen.getByPlaceholderText('Digite o nome do produto');
      const sizeInput = screen.getByPlaceholderText('Digite o tamanho');
      const regularInput = screen.getByPlaceholderText(
        'Digite o preço regular',
      );
      const memberInput = screen.getByPlaceholderText(
        'Digite o preço de membro',
      );
      const pvInput = screen.getByPlaceholderText('Digite o PV');
      const urlInput = screen.getByPlaceholderText(
        'https://www.doterra.com/BR/pt_BR/...',
      );

      fireEvent.change(codeInput, { target: { value: '60226006' } });
      fireEvent.change(nameInput, { target: { value: 'Adaptiv® Pastilhas' } });
      fireEvent.change(sizeInput, { target: { value: '60 pastilhas' } });
      fireEvent.change(regularInput, { target: { value: '308.00' } });
      fireEvent.change(memberInput, { target: { value: '231.25' } });
      fireEvent.change(pvInput, { target: { value: '31' } });
      fireEvent.change(urlInput, {
        target: { value: 'https://www.doterra.com/BR/pt_BR/p/adaptiv' },
      });
      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/products', {
          code: '60226006',
          name: 'Adaptiv® Pastilhas',
          size: '60 pastilhas',
          regularPrice: 308.0,
          memberPrice: 231.25,
          pv: 31,
          doterraUrl: 'https://www.doterra.com/BR/pt_BR/p/adaptiv',
          productType: 'SIMPLES',
          components: [],
        });
      });
    });

    it('should send null doterraUrl when the field is left empty', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      mockPost.mockResolvedValue({ data: { ...mockProduct } });

      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const codeInput = await screen.findByPlaceholderText('Digite o código');
      fireEvent.change(codeInput, { target: { value: '60226006' } });
      fireEvent.change(
        screen.getByPlaceholderText('Digite o nome do produto'),
        { target: { value: 'Adaptiv® Pastilhas' } },
      );
      fireEvent.change(screen.getByPlaceholderText('Digite o tamanho'), {
        target: { value: '60 pastilhas' },
      });
      fireEvent.change(screen.getByPlaceholderText('Digite o preço regular'), {
        target: { value: '308.00' },
      });
      fireEvent.change(
        screen.getByPlaceholderText('Digite o preço de membro'),
        { target: { value: '231.25' } },
      );
      fireEvent.change(screen.getByPlaceholderText('Digite o PV'), {
        target: { value: '31' },
      });

      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith(
          '/products',
          expect.objectContaining({
            doterraUrl: null,
          }),
        );
      });
    });

    it('should add the created product to the list without refetching', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      mockPost.mockResolvedValue({ data: { ...mockProduct } });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo')).toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText('Novo'));

      const codeInput = await screen.findByPlaceholderText('Digite o código');
      fireEvent.change(codeInput, { target: { value: '60226006' } });
      fireEvent.change(
        screen.getByPlaceholderText('Digite o nome do produto'),
        { target: { value: 'Adaptiv® Pastilhas' } },
      );
      fireEvent.change(screen.getByPlaceholderText('Digite o tamanho'), {
        target: { value: '60 pastilhas' },
      });
      fireEvent.change(screen.getByPlaceholderText('Digite o preço regular'), {
        target: { value: '308.00' },
      });
      fireEvent.change(
        screen.getByPlaceholderText('Digite o preço de membro'),
        { target: { value: '231.25' } },
      );
      fireEvent.change(screen.getByPlaceholderText('Digite o PV'), {
        target: { value: '31' },
      });

      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edit Product', () => {
    it('should open edit modal with pre-filled data and disabled code field', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickProductAction('1', 'Editar');

      await waitFor(() => {
        expect(screen.getByText('Editar Produto')).toBeInTheDocument();
        expect(screen.getByDisplayValue('60226006')).toBeDisabled();
        expect(
          screen.getByDisplayValue('Adaptiv® Pastilhas'),
        ).toBeInTheDocument();
        expect(screen.getByDisplayValue('308')).toBeInTheDocument();
        expect(screen.getByDisplayValue('231.25')).toBeInTheDocument();
        expect(screen.getByDisplayValue('31')).toBeInTheDocument();
      });
    });

    it('should call PUT API on form submit with status, doterraUrl and prices', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      mockPut.mockResolvedValue({
        data: { ...mockProduct, name: 'Adaptiv® Atualizado' },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickProductAction('1', 'Editar');

      const nameInput = await screen.findByDisplayValue('Adaptiv® Pastilhas');
      fireEvent.change(nameInput, { target: { value: 'Adaptiv® Atualizado' } });

      const form = nameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/products/1', {
          name: 'Adaptiv® Atualizado',
          size: '60 pastilhas',
          status: 'ATIVO',
          doterraUrl: null,
          regularPrice: 308,
          memberPrice: 231.25,
          pv: 31,
          productType: 'SIMPLES',
          components: [],
        });
      });
    });

    it('should send updated prices on submit', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      mockPut.mockResolvedValue({
        data: {
          ...mockProduct,
          regularPrice: 320.0,
          memberPrice: 240.0,
          pv: 33,
        },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickProductAction('1', 'Editar');

      const regularInput = await screen.findByDisplayValue('308');
      fireEvent.change(regularInput, { target: { value: '320' } });
      fireEvent.change(screen.getByDisplayValue('231.25'), {
        target: { value: '240' },
      });
      fireEvent.change(screen.getByDisplayValue('31'), {
        target: { value: '33' },
      });

      const form = regularInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/products/1', {
          name: 'Adaptiv® Pastilhas',
          size: '60 pastilhas',
          status: 'ATIVO',
          doterraUrl: null,
          regularPrice: 320,
          memberPrice: 240,
          pv: 33,
          productType: 'SIMPLES',
          components: [],
        });
      });
    });

    it('should update the status select to INDISPONIVEL and send it', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      mockPut.mockResolvedValue({
        data: { ...mockProduct, status: 'INDISPONIVEL' },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickProductAction('1', 'Editar');

      const statusSelect = await screen.findByTestId('edit-status-select');
      fireEvent.change(statusSelect, { target: { value: 'INDISPONIVEL' } });

      const form = statusSelect.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith(
          '/products/1',
          expect.objectContaining({
            status: 'INDISPONIVEL',
          }),
        );
      });
    });

    it('should ask for discard confirmation when only the status is changed and the backdrop is clicked', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickProductAction('1', 'Editar');

      const statusSelect = await screen.findByTestId('edit-status-select');
      fireEvent.change(statusSelect, { target: { value: 'INDISPONIVEL' } });

      fireEvent.mouseDown(
        document.querySelector('[data-testid="modal-backdrop"]'),
      );

      expect(
        screen.getByRole('button', { name: 'Descartar' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Editar Produto')).toBeInTheDocument();
    });

    it('should update the row in place without refetching the list', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      mockPut.mockResolvedValue({
        data: { ...mockProduct, name: 'Adaptiv® Atualizado' },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);

      await clickProductAction('1', 'Editar');

      const nameInput = await screen.findByDisplayValue('Adaptiv® Pastilhas');
      fireEvent.change(nameInput, {
        target: { value: 'Adaptiv® Atualizado' },
      });

      const form = nameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Atualizado')).toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should render "Salvar e editar próximo" and open the next product on click', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockInactiveProduct]),
      });
      mockPut.mockResolvedValue({
        data: { ...mockProduct, name: 'Adaptiv® Atualizado' },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);

      await clickProductAction('1', 'Editar');

      const saveAndNextButton = await screen.findByRole('button', {
        name: 'Salvar e editar próximo',
      });
      expect(saveAndNextButton).toBeEnabled();

      fireEvent.click(saveAndNextButton);

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/products/1', expect.anything());
      });

      await waitFor(() => {
        expect(screen.getByText('Editar Produto')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Basil')).toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should disable "Salvar e editar próximo" when editing the last product', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickProductAction('1', 'Editar');

      const saveAndNextButton = await screen.findByRole('button', {
        name: 'Salvar e editar próximo',
      });
      expect(saveAndNextButton).toBeDisabled();
    });
  });

  describe('Inline status change', () => {
    it('should open the status menu when clicking the badge', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('product-status-ATIVO'));

      await waitFor(() => {
        expect(screen.getByTestId('product-status-menu-1')).toBeInTheDocument();
        expect(
          screen.getByTestId('product-status-1-option-ATIVO'),
        ).toHaveTextContent('Ativo');
        expect(
          screen.getByTestId('product-status-1-option-INDISPONIVEL'),
        ).toHaveTextContent('Indisponível');
        expect(
          screen.getByTestId('product-status-1-option-INATIVO'),
        ).toHaveTextContent('Inativo');
      });
    });

    it('should call PUT to change status when confirming', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      mockPut.mockResolvedValue({
        data: { ...mockProduct, status: 'INATIVO' },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('product-status-ATIVO'));
      fireEvent.click(screen.getByTestId('product-status-1-option-INATIVO'));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', { name: 'Confirmar alteração' }),
      );

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/products/1', {
          status: 'INATIVO',
        });
      });
    });

    it('should update the status in place without refetching the list', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      mockPut.mockResolvedValue({
        data: { ...mockProduct, status: 'INATIVO' },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('product-status-ATIVO'));
      fireEvent.click(screen.getByTestId('product-status-1-option-INATIVO'));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', { name: 'Confirmar alteração' }),
      );

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('product-status-INATIVO'),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId('product-status-ATIVO'),
      ).not.toBeInTheDocument();
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should not change status when cancelling', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('product-status-ATIVO'));
      fireEvent.click(screen.getByTestId('product-status-1-option-INATIVO'));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(mockPut).not.toHaveBeenCalled();
    });

    it('should not open the confirm dialog when selecting the current status', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('product-status-ATIVO'));
      fireEvent.click(screen.getByTestId('product-status-1-option-ATIVO'));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('should close the status menu when clicking the backdrop', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('product-status-ATIVO'));

      await waitFor(() => {
        expect(screen.getByTestId('product-status-menu-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('product-status-1-backdrop'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('product-status-menu-1'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Action Menu (kebab)', () => {
    it('should render one kebab trigger per row', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockProduct, mockInactiveProduct]),
      });
      renderPage();

      await waitFor(() => {
        expect(
          screen.getAllByTestId(/product-actions-.*-trigger/),
        ).toHaveLength(2);
      });
    });

    it('should keep the menu hidden until the trigger is clicked', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(
          screen.getByTestId('product-actions-1-trigger'),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId('product-actions-1-menu'),
      ).not.toBeInTheDocument();
    });

    it('should show Editar item when the trigger is clicked', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await openProductActionsMenu('1');

      expect(
        screen.getByTestId('product-actions-1-item-Editar'),
      ).toHaveTextContent('Editar');
    });

    it('should expose correct a11y semantics on trigger, menu and items', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      const trigger = await screen.findByTestId('product-actions-1-trigger');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await openProductActionsMenu('1');

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('product-actions-1-menu')).toHaveAttribute(
        'role',
        'menu',
      );
      expect(
        screen.getByTestId('product-actions-1-item-Editar'),
      ).toHaveAttribute('role', 'menuitem');
    });

    it('should close the menu when clicking the backdrop', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await openProductActionsMenu('1');

      fireEvent.click(screen.getByTestId('product-actions-1-backdrop'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('product-actions-1-menu'),
        ).not.toBeInTheDocument();
      });
    });

    it('should close the menu when pressing Escape', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await openProductActionsMenu('1');

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(
          screen.queryByTestId('product-actions-1-menu'),
        ).not.toBeInTheDocument();
      });
    });

    it('should open the edit modal when clicking the Editar item', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickProductAction('1', 'Editar');

      await waitFor(() => {
        expect(screen.getByText('Editar Produto')).toBeInTheDocument();
      });
    });
  });

  describe('Clipboard copy', () => {
    const writeText = () => navigator.clipboard.writeText;

    it('should copy the code to the clipboard when clicking the code cell', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('product-code-1'));

      await waitFor(() => {
        expect(writeText()).toHaveBeenCalledWith('60226006');
        expect(screen.getByText('Código copiado!')).toBeInTheDocument();
      });
    });

    it('should copy the name to the clipboard when clicking the name cell', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('product-name-1'));

      await waitFor(() => {
        expect(writeText()).toHaveBeenCalledWith('Adaptiv® Pastilhas');
        expect(screen.getByText('Nome copiado!')).toBeInTheDocument();
      });
    });

    it('should copy the full formatted row when clicking the Copiar linha action', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickProductAction('1', 'Copiar-linha');

      await waitFor(() => {
        expect(writeText()).toHaveBeenCalledWith(
          [
            'Adaptiv® Pastilhas (60 pastilhas)',
            'Preço Regular: R$\u00A0308,00',
            'Preço de Membros: R$\u00A0231,25',
            'PV: 31',
          ].join('\n'),
        );
        expect(screen.getByText('Linha copiada!')).toBeInTheDocument();
      });
    });

    it('should append the product URL when the product has one', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockUnavailableProduct]),
      });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Deep Blue')).toBeInTheDocument();
      });

      await clickProductAction('3', 'Copiar-linha');

      await waitFor(() => {
        expect(writeText()).toHaveBeenCalledWith(
          [
            'Deep Blue (10 ml)',
            'Preço Regular: R$\u00A0150,00',
            'Preço de Membros: R$\u00A0112,50',
            'PV: 15',
            'https://www.doterra.com/BR/pt_BR/p/deep-blue',
          ].join('\n'),
        );
      });
    });

    it('should omit the size parentheses when the product has no size', async () => {
      const noSizeProduct = {
        ...mockProduct,
        id: '9',
        size: '',
      };
      mockGet.mockResolvedValue({ data: fullResponse([noSizeProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      await clickProductAction('9', 'Copiar-linha');

      await waitFor(() => {
        expect(writeText()).toHaveBeenCalledWith(
          [
            'Adaptiv® Pastilhas',
            'Preço Regular: R$\u00A0308,00',
            'Preço de Membros: R$\u00A0231,25',
            'PV: 31',
          ].join('\n'),
        );
      });
    });

    it('should render a non-clickable placeholder when the name is empty', async () => {
      const noNameProduct = {
        ...mockProduct,
        id: '10',
        name: '',
      };
      mockGet.mockResolvedValue({ data: fullResponse([noNameProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('product-code-10')).toBeInTheDocument();
      });

      const row = screen.getByTestId('product-code-10').closest('tr');
      expect(row.querySelector('[data-label="Produto"]')).toHaveTextContent(
        '—',
      );
      expect(screen.queryByTestId('product-name-10')).not.toBeInTheDocument();
    });

    it('should show an error toast when the clipboard write fails', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: vi.fn().mockRejectedValue(new Error('denied')),
        },
      });
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('product-code-1'));

      await waitFor(() => {
        expect(
          screen.getByText('Falha ao copiar. Tente novamente.'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Kit product form', () => {
    const mockComponent = {
      id: '10',
      code: 'COMP1',
      name: 'Componente Lavanda',
      size: '15 ml',
      status: 'ATIVO',
      productType: 'SIMPLES',
      regularPrice: 10,
      memberPrice: 7.5,
      pv: 1,
      pricePerPv: '7.50',
      doterraUrl: null,
    };
    const mockKit = {
      id: '5',
      code: 'KIT1',
      name: 'Kit Bem-estar',
      size: 'kit',
      status: 'ATIVO',
      productType: 'KIT',
      regularPrice: 150,
      memberPrice: 120,
      pv: 15,
      pricePerPv: '8.00',
      doterraUrl: null,
      components: [{ componentProductId: '10', quantity: 2 }],
    };

    const openCreateModal = async () => {
      renderPage();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });
      await screen.findByText('Novo Produto');
    };

    const selectKitType = () => {
      fireEvent.click(screen.getByTestId('product-type-radio-KIT'));
    };

    const fillBaseFields = (code) => {
      fireEvent.change(screen.getByPlaceholderText('Digite o código'), {
        target: { value: code },
      });
      fireEvent.change(
        screen.getByPlaceholderText('Digite o nome do produto'),
        { target: { value: 'Kit Teste' } },
      );
      fireEvent.change(screen.getByPlaceholderText('Digite o tamanho'), {
        target: { value: 'kit' },
      });
      fireEvent.change(screen.getByPlaceholderText('Digite o preço regular'), {
        target: { value: '150.00' },
      });
      fireEvent.change(
        screen.getByPlaceholderText('Digite o preço de membro'),
        { target: { value: '120.00' } },
      );
      fireEvent.change(screen.getByPlaceholderText('Digite o PV'), {
        target: { value: '15' },
      });
    };

    it('defaults to SIMPLES and hides the kit builder', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockComponent]) });
      await openCreateModal();

      expect(screen.getByTestId('product-type-radio-SIMPLES')).toBeChecked();
      expect(screen.getByTestId('product-type-radio-KIT')).not.toBeChecked();
      expect(
        screen.queryByText('Adicionar componente'),
      ).not.toBeInTheDocument();
    });

    it('reveals the component builder when KIT is selected', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockComponent]) });
      await openCreateModal();
      selectKitType();

      expect(screen.getByText('Adicionar componente')).toBeInTheDocument();
    });

    it('blocks saving a kit without any component', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockComponent]) });
      await openCreateModal();
      selectKitType();
      fillBaseFields('KIT1');

      const form = screen
        .getByPlaceholderText('Digite o código')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText('É obrigatório vincular ao menos um produto ao kit'),
        ).toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('sends productType KIT and components in the create payload', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockComponent]) });
      mockPost.mockResolvedValue({ data: { ...mockKit } });
      await openCreateModal();
      selectKitType();

      fireEvent.click(screen.getByText('Adicionar componente'));
      const combobox = screen.getAllByPlaceholderText(
        'Busque um produto...',
      )[0];
      fireEvent.change(combobox, { target: { value: 'Lavanda' } });
      const componentOption = screen.getAllByText(/Componente Lavanda/).at(-1);
      fireEvent.mouseDown(componentOption);
      fireEvent.change(screen.getByTestId('kit-component-quantity-0'), {
        target: { value: '3' },
      });

      fillBaseFields('KIT1');
      const form = screen
        .getByPlaceholderText('Digite o código')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => expect(mockPost).toHaveBeenCalled());
      expect(mockPost).toHaveBeenCalledWith(
        '/products',
        expect.objectContaining({
          productType: 'KIT',
          components: [{ componentProductId: '10', quantity: 3 }],
        }),
      );
    });

    it('loads the kit composition when editing', async () => {
      mockGet.mockResolvedValue({
        data: fullResponse([mockComponent, mockKit]),
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Kit Bem-estar')).toBeInTheDocument();
      });

      await clickProductAction('5', 'Editar');
      await waitFor(() => {
        expect(screen.getByText('Editar Produto')).toBeInTheDocument();
      });

      expect(screen.getByTestId('product-type-radio-KIT')).toBeChecked();
      expect(
        screen.getByTestId('product-type-radio-SIMPLES'),
      ).not.toBeChecked();
      expect(
        screen.getAllByPlaceholderText('Busque um produto...')[0].value,
      ).toContain('Componente Lavanda');
      expect(screen.getByTestId('kit-component-quantity-0').value).toBe('2');
    });

    it('blocks saving a kit whose component row is empty', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockComponent]) });
      await openCreateModal();
      selectKitType();
      fireEvent.click(screen.getByText('Adicionar componente'));
      fillBaseFields('KIT2');

      const form = screen
        .getByPlaceholderText('Digite o código')
        .closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText('É obrigatório vincular ao menos um produto ao kit'),
        ).toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });
  });
});
