import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFinanceCategories } from '../src/pages/Finances/useFinanceCategories';
import FinancialCategoryModal from '../src/pages/Finances/components/FinancialCategoryModal';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
}));

const categories = [
  {
    id: 'cat-vendas',
    name: 'Vendas',
    type: 'RECEITA',
    isDefault: true,
    active: true,
  },
  {
    id: 'cat-bonus',
    name: 'Bônus dōTERRA',
    type: 'RECEITA',
    isDefault: true,
    active: true,
  },
  {
    id: 'cat-doterra',
    name: 'Compra de produtos dōTERRA',
    type: 'DESPESA',
    isDefault: true,
    active: true,
  },
  {
    id: 'cat-viagens',
    name: 'Viagens',
    type: 'DESPESA',
    isDefault: false,
    active: true,
  },
];

const Harness = () => {
  const finances = useFinanceCategories();

  return (
    <>
      <button type="button" onClick={finances.openModal}>
        Gerenciar categorias
      </button>
      <FinancialCategoryModal
        isOpen={finances.showModal}
        onClose={finances.closeModal}
        categories={finances.categories}
        loading={finances.loading}
        loadError={finances.loadError}
        form={finances.form}
        formError={finances.formError}
        submitting={finances.submitting}
        isDirty={finances.isDirty}
        onChangeField={finances.setFormField}
        onSubmit={finances.handleSubmit}
        onStartEdit={finances.startEdit}
        onCancelEdit={finances.cancelEdit}
        onToggleActive={finances.toggleActive}
      />
    </>
  );
};

const renderHarness = () =>
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

const openModal = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Gerenciar categorias' }));
  await screen.findByText('Categorias financeiras');
};

const fillName = (value) =>
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value } });

const selectType = (value) =>
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value } });

const submitForm = () =>
  fireEvent.click(
    screen.getByRole('button', {
      name: screen.queryByRole('button', { name: 'Salvar' })
        ? 'Salvar'
        : 'Adicionar',
    }),
  );

describe('FinancialCategoryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: categories });
  });

  it('lists the categories grouped by type', async () => {
    renderHarness();
    await openModal();

    const income = screen.getByTestId('category-section-RECEITA');
    expect(within(income).getByText('Vendas')).toBeInTheDocument();
    expect(within(income).getByText('Bônus dōTERRA')).toBeInTheDocument();

    const expenses = screen.getByTestId('category-section-DESPESA');
    expect(
      within(expenses).getByText('Compra de produtos dōTERRA'),
    ).toBeInTheDocument();
    expect(within(expenses).getByText('Viagens')).toBeInTheDocument();
  });

  it('uses a wide modal and renders the full category name without truncation', async () => {
    const longName = 'Compra de produtos dōTERRA e materiais de escritório';
    mockGet.mockResolvedValue({
      data: [
        {
          id: 'cat-longa',
          name: longName,
          type: 'DESPESA',
          isDefault: false,
          active: true,
        },
      ],
    });

    renderHarness();
    await openModal();

    const name = screen.getByTestId('category-name-cat-longa');
    expect(name).toHaveTextContent(longName);
    expect(name).toHaveAttribute('title', longName);
    expect(name.className).not.toContain('truncate');
    expect(name.className).toContain('break-words');

    const panel = screen
      .getByTestId('finance-category-modal')
      .querySelector(':scope > div');
    expect(panel.className).toContain('max-w-4xl');
  });

  it('marks default and inactive categories', async () => {
    mockGet.mockResolvedValue({
      data: [
        ...categories,
        {
          id: 'cat-antiga',
          name: 'Categoria antiga',
          type: 'DESPESA',
          isDefault: false,
          active: false,
        },
      ],
    });

    renderHarness();
    await openModal();

    expect(screen.getByTestId('category-default-cat-vendas')).toHaveTextContent(
      'Padrão',
    );
    expect(
      screen.getByTestId('category-inactive-cat-antiga'),
    ).toHaveTextContent('Inativa');
  });

  it('creates a custom RECEITA category', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: 'cat-palestras',
        name: 'Palestras',
        type: 'RECEITA',
        isDefault: false,
        active: true,
      },
    });

    renderHarness();
    await openModal();

    selectType('RECEITA');
    fillName('Palestras');
    submitForm();

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/finances/categories', {
        name: 'Palestras',
        type: 'RECEITA',
      }),
    );

    const income = screen.getByTestId('category-section-RECEITA');
    expect(await within(income).findByText('Palestras')).toBeInTheDocument();
  });

  it('creates a custom DESPESA category by default', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: 'cat-viagens-nova',
        name: 'Viagens corporativas',
        type: 'DESPESA',
        isDefault: false,
        active: true,
      },
    });

    renderHarness();
    await openModal();

    fillName('Viagens corporativas');
    submitForm();

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/finances/categories', {
        name: 'Viagens corporativas',
        type: 'DESPESA',
      }),
    );
  });

  it('shows a validation error when the name is empty and does not call the API', async () => {
    renderHarness();
    await openModal();

    submitForm();

    expect(await screen.findByTestId('category-form-error')).toHaveTextContent(
      'Informe o nome da categoria',
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('shows the API error when the category already exists', async () => {
    mockPost.mockRejectedValue({
      response: { data: { error: 'A categoria já existe' } },
    });

    renderHarness();
    await openModal();

    fillName('Vendas');
    submitForm();

    expect(await screen.findByTestId('category-form-error')).toHaveTextContent(
      'A categoria já existe',
    );
  });

  it('renames a category in place', async () => {
    mockPut.mockResolvedValue({
      data: {
        id: 'cat-viagens',
        name: 'Viagens e eventos',
        type: 'DESPESA',
        isDefault: false,
        active: true,
      },
    });

    renderHarness();
    await openModal();

    fireEvent.click(screen.getByTestId('category-edit-cat-viagens'));

    expect(screen.getByLabelText('Tipo')).toBeDisabled();
    expect(screen.getByLabelText('Nome')).toHaveValue('Viagens');

    fillName('Viagens e eventos');
    submitForm();

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/finances/categories/cat-viagens', {
        name: 'Viagens e eventos',
      }),
    );

    expect(await screen.findByText('Viagens e eventos')).toBeInTheDocument();
  });

  it('deactivates and reactivates a category', async () => {
    mockPut.mockResolvedValue({
      data: { ...categories[3], active: false },
    });

    renderHarness();
    await openModal();

    fireEvent.click(screen.getByTestId('category-toggle-cat-viagens'));

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/finances/categories/cat-viagens', {
        active: false,
      }),
    );
    expect(
      await screen.findByTestId('category-inactive-cat-viagens'),
    ).toBeInTheDocument();

    mockPut.mockResolvedValueOnce({
      data: { ...categories[3], active: true },
    });

    fireEvent.click(screen.getByTestId('category-toggle-cat-viagens'));

    await waitFor(() =>
      expect(mockPut).toHaveBeenLastCalledWith(
        '/finances/categories/cat-viagens',
        { active: true },
      ),
    );
  });

  it('shows the load error when categories cannot be fetched', async () => {
    mockGet.mockRejectedValue(new Error('network down'));

    renderHarness();
    await openModal();

    expect(await screen.findByTestId('category-load-error')).toHaveTextContent(
      'Erro ao carregar categorias',
    );
  });

  it('closes immediately when there are no pending changes', async () => {
    renderHarness();
    await openModal();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    await waitFor(() =>
      expect(
        screen.queryByTestId('finance-category-modal'),
      ).not.toBeInTheDocument(),
    );
  });

  it('asks to discard before closing with unsaved changes', async () => {
    renderHarness();
    await openModal();

    fillName('Rascunho');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(
      await screen.findByText('Descartar alterações?'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

    await waitFor(() =>
      expect(
        screen.queryByTestId('finance-category-modal'),
      ).not.toBeInTheDocument(),
    );
  });
});
