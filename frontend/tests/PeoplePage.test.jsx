import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PeoplePage from '../src/pages/PeoplePage';

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

const renderPage = () => {
  return render(
    <MemoryRouter>
      <PeoplePage />
    </MemoryRouter>
  );
};

describe('PeoplePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render "Cadastro de Pessoas"', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Cadastro de Pessoas')).toBeInTheDocument();
      });
    });

    it('should render "Novo" button', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Novo')).toBeInTheDocument();
      });
    });

    it('should show empty state when no people exist', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nenhuma pessoa cadastrada')).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      mockGet.mockImplementation(() => new Promise(() => {}));
      renderPage();
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });
  });

  describe('People List', () => {
    const mockPeople = [
      { id: '1', name: 'João Silva', contact: 'joao@email.com' },
      { id: '2', name: 'Maria Santos', contact: 'maria@email.com' },
    ];

    it('should display people in a table', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
        expect(screen.getByText('Maria Santos')).toBeInTheDocument();
        expect(screen.getByText('joao@email.com')).toBeInTheDocument();
      });
    });

    it('should display Edit and Delete buttons', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText('Editar')).toHaveLength(2);
        expect(screen.getAllByText('Excluir')).toHaveLength(2);
      });
    });
  });

  describe('Create Person Modal', () => {
    it('should open modal when clicking "Novo"', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo'));

      await waitFor(() => {
        expect(screen.getByText('Nova Pessoa')).toBeInTheDocument();
      });
    });

    it('should close modal when clicking "Fechar"', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      await waitFor(() => {
        expect(screen.getByText('Nova Pessoa')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Fechar'));

      await waitFor(() => {
        expect(screen.queryByText('Nova Pessoa')).not.toBeInTheDocument();
      });
    });

    it('should show validation error when submitting empty name', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const nameInput = await screen.findByPlaceholderText('Digite o nome');
      const form = nameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Nome é obrigatório')).toBeInTheDocument();
      });
    });

    it('should create person and call API', async () => {
      mockGet.mockResolvedValue({ data: [] });
      mockPost.mockResolvedValue({ data: { id: '3', name: 'Novo', contact: 'novo@email.com' } });

      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const nameInput = await screen.findByPlaceholderText('Digite o nome');
      const contactInput = screen.getByPlaceholderText('Digite o contato (opcional)');

      fireEvent.change(nameInput, { target: { value: 'Novo' } });
      fireEvent.change(contactInput, { target: { value: 'novo@email.com' } });
      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/people', {
          name: 'Novo',
          contact: 'novo@email.com',
        });
      });
    });
  });

  describe('Edit Person', () => {
    const mockPeople = [
      { id: '1', name: 'João Silva', contact: 'joao@email.com' },
    ];

    it('should open edit modal with pre-filled data', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Editar'));

      await waitFor(() => {
        expect(screen.getByText('Editar Pessoa')).toBeInTheDocument();
        expect(screen.getByDisplayValue('João Silva')).toBeInTheDocument();
        expect(screen.getByDisplayValue('joao@email.com')).toBeInTheDocument();
      });
    });

    it('should call PUT API on form submit', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      mockPut.mockResolvedValue({ data: { id: '1', name: 'Updated', contact: 'joao@email.com' } });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Editar'));

      const nameInput = await screen.findByDisplayValue('João Silva');
      fireEvent.change(nameInput, { target: { value: 'Updated' } });

      await waitFor(() => {
        expect(screen.getByText('Editar Pessoa')).toBeInTheDocument();
      });

      const form = nameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/people/1', {
          name: 'Updated',
          contact: 'joao@email.com',
        });
      });
    });
  });

  describe('Delete Person', () => {
    const mockPeople = [
      { id: '1', name: 'João Silva', contact: 'joao@email.com' },
    ];

    it('should delete when confirming', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      mockDelete.mockResolvedValue({ data: { message: 'Person deleted' } });
      window.confirm = vi.fn(() => true);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Excluir'));

      expect(window.confirm).toHaveBeenCalled();
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('/people/1');
      });
    });

    it('should not delete when cancelling', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      window.confirm = vi.fn(() => false);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Excluir'));

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
