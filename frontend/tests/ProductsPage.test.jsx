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
  doterraUrl: 'https://www.doterra.com/BR/pt_BR/p/deep-blue',
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
    .map((row) => row.querySelector('td:nth-child(2)').textContent);

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.IntersectionObserver = MockIntersectionObserver;
    MockIntersectionObserver.callback = null;
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
        expect(screen.getByText('—')).toBeInTheDocument();
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

    it('should re-attach the infinite scroll observer after creating a product', async () => {
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
      mockPost.mockResolvedValue({ data: { ...mockProduct } });

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
        expect(mockGet).toHaveBeenCalledTimes(2);
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
  });

  describe('Inline status change', () => {
    it('should call PUT to change status when confirming', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      mockPut.mockResolvedValue({
        data: { ...mockProduct, status: 'INATIVO' },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Alterar status'), {
        target: { value: 'INATIVO' },
      });

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

    it('should not change status when cancelling', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Alterar status'), {
        target: { value: 'INATIVO' },
      });

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(mockPut).not.toHaveBeenCalled();
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
});
