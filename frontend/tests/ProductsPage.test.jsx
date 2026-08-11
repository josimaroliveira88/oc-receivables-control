import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProductsPage from '../src/pages/ProductsPage';

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
  constructor(callback) {
    MockIntersectionObserver.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  static trigger(entry) {
    if (MockIntersectionObserver.callback) {
      MockIntersectionObserver.callback([entry]);
    }
  }
}

const mockProduct = {
  id: '1',
  code: '60226006',
  name: 'Adaptiv® Pastilhas',
  size: '60 pastilhas',
  active: true,
  regularPrice: 308.0,
  memberPrice: 231.25,
  pv: 31,
};

const mockInactiveProduct = {
  id: '2',
  code: '60215485',
  name: 'Basil',
  size: '5 ml',
  active: false,
  regularPrice: 103.0,
  memberPrice: 77.5,
  pv: 9,
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
  active: true,
  regularPrice: 100 + i,
  memberPrice: 75 + i,
  pv: 5 + i,
}));

const renderPage = () => {
  return render(
    <MemoryRouter>
      <ProductsPage />
    </MemoryRouter>
  );
};

const rowNames = () =>
  screen.getAllByRole('row').slice(1).map((row) => row.querySelector('td:nth-child(2)').textContent);

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
        expect(screen.getByPlaceholderText('Buscar por nome ou código...')).toBeInTheDocument();
        expect(screen.getByLabelText('Ordenar por')).toBeInTheDocument();
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
      });
    });

    it('should show empty state when no products exist', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([]) });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nenhum produto cadastrado')).toBeInTheDocument();
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

    it('should display status badge for active and inactive products', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct, mockInactiveProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Ativo')).toBeInTheDocument();
        expect(screen.getByText('Inativo')).toBeInTheDocument();
      });
    });

    it('should show the product count from the in-memory list', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct, mockInactiveProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('2 produtos')).toBeInTheDocument();
      });
    });
  });

  describe('Client-side Search, Filter and Sort', () => {
    it('should filter the list by name without a new API call', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct, mockInactiveProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);

      fireEvent.change(screen.getByPlaceholderText('Buscar por nome ou código...'), {
        target: { value: 'Basil' },
      });

      await waitFor(() => {
        expect(screen.getByText('Basil')).toBeInTheDocument();
        expect(screen.queryByText('Adaptiv® Pastilhas')).not.toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should filter the list by code without a new API call', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct, mockInactiveProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Buscar por nome ou código...'), {
        target: { value: '60226006' },
      });

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
        expect(screen.queryByText('Basil')).not.toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should filter the list by active status without a new API call', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct, mockInactiveProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'true' } });

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
        expect(screen.queryByText('Basil')).not.toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should filter the list by inactive status without a new API call', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct, mockInactiveProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'false' } });

      await waitFor(() => {
        expect(screen.getByText('Basil')).toBeInTheDocument();
        expect(screen.queryByText('Adaptiv® Pastilhas')).not.toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should sort the list by PV ascending without a new API call', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct, mockInactiveProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'pv:asc' } });

      await waitFor(() => {
        expect(rowNames()).toEqual(['Basil', 'Adaptiv® Pastilhas']);
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should sort the list by name descending without a new API call', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct, mockInactiveProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'name:desc' } });

      await waitFor(() => {
        expect(rowNames()).toEqual(['Basil', 'Adaptiv® Pastilhas']);
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should show filtered empty state when a filter yields no results', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct, mockInactiveProduct]) });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Buscar por nome ou código...'), {
        target: { value: 'NãoExiste' },
      });

      await waitFor(() => {
        expect(screen.getByText('Nenhum produto encontrado para os filtros aplicados.')).toBeInTheDocument();
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
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct, mockInactiveProduct]) });

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

      const form = (await screen.findByPlaceholderText('Digite o código')).closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Código é obrigatório')).toBeInTheDocument();
      });
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
      const regularInput = screen.getByPlaceholderText('Digite o preço regular');
      const memberInput = screen.getByPlaceholderText('Digite o preço de membro');
      const pvInput = screen.getByPlaceholderText('Digite o PV');

      fireEvent.change(codeInput, { target: { value: '60226006' } });
      fireEvent.change(nameInput, { target: { value: 'Adaptiv® Pastilhas' } });
      fireEvent.change(sizeInput, { target: { value: '60 pastilhas' } });
      fireEvent.change(regularInput, { target: { value: '308.00' } });
      fireEvent.change(memberInput, { target: { value: '231.25' } });
      fireEvent.change(pvInput, { target: { value: '31' } });
      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/products', {
          code: '60226006',
          name: 'Adaptiv® Pastilhas',
          size: '60 pastilhas',
          regularPrice: 308.0,
          memberPrice: 231.25,
          pv: 31,
        });
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

      fireEvent.click(screen.getByText('Editar'));

      await waitFor(() => {
        expect(screen.getByText('Editar Produto')).toBeInTheDocument();
        expect(screen.getByDisplayValue('60226006')).toBeDisabled();
        expect(screen.getByDisplayValue('Adaptiv® Pastilhas')).toBeInTheDocument();
      });
    });

    it('should call PUT API on form submit', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      mockPut.mockResolvedValue({ data: { ...mockProduct, name: 'Adaptiv® Atualizado' } });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Editar'));

      const nameInput = await screen.findByDisplayValue('Adaptiv® Pastilhas');
      fireEvent.change(nameInput, { target: { value: 'Adaptiv® Atualizado' } });

      const form = nameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/products/1', {
          name: 'Adaptiv® Atualizado',
          size: '60 pastilhas',
          active: true,
        });
      });
    });
  });

  describe('Deactivate Product', () => {
    it('should call PUT to deactivate when confirming', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      mockPut.mockResolvedValue({ data: { ...mockProduct, active: false } });
      window.confirm = vi.fn(() => true);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Desativar'));

      expect(window.confirm).toHaveBeenCalled();
      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/products/1', { active: false });
      });
    });

    it('should not deactivate when cancelling', async () => {
      mockGet.mockResolvedValue({ data: fullResponse([mockProduct]) });
      window.confirm = vi.fn(() => false);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Adaptiv® Pastilhas')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Desativar'));

      expect(mockPut).not.toHaveBeenCalled();
    });
  });
});
