import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProductsPage from '../src/pages/ProductsPage';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockPut = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: vi.fn(),
    put: (...args) => mockPut(...args),
    delete: vi.fn(),
  },
}));

const draftProduct = {
  id: 'draft-1',
  code: 'DTX1',
  name: 'Produto rascunho',
  size: '',
  status: 'PENDENTE_CADASTRO',
  productType: 'SIMPLES',
  regularPrice: '0.00',
  memberPrice: '150.00',
  pv: '20.00',
  pricePerPv: '7.50',
  doterraUrl: null,
  components: [],
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <ProductsPage />
      </ToastProvider>
    </MemoryRouter>,
  );

describe('Products — pendente de cadastro (draft from the dōTERRA import)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: { data: [draftProduct] } });
  });

  it('renders the "Pendente de cadastro" badge', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Pendente de cadastro')).toBeInTheDocument();
    });
  });

  it('offers a filter option for drafts', async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Pendentes de cadastro' }),
      ).toBeInTheDocument();
    });
  });

  it('activates a draft through the existing status-change confirmation', async () => {
    mockPut.mockResolvedValue({ data: { ...draftProduct, status: 'ATIVO' } });
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByTestId('product-status-PENDENTE_CADASTRO'),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('product-status-PENDENTE_CADASTRO'));
    fireEvent.click(screen.getByTestId('product-status-draft-1-option-ATIVO'));

    await waitFor(() => {
      expect(screen.getByText('Alterar status do produto')).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar alteração' }),
    );

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/products/draft-1', {
        status: 'ATIVO',
      });
    });
  });
});
