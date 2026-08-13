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

const openClientActionsMenu = async (clientId) => {
  await waitFor(() => {
    expect(screen.getByTestId(`client-actions-${clientId}-trigger`)).toBeInTheDocument();
  });
  fireEvent.click(screen.getByTestId(`client-actions-${clientId}-trigger`));
  await waitFor(() => {
    expect(screen.getByTestId(`client-actions-${clientId}-menu`)).toBeInTheDocument();
  });
};

const clickClientAction = async (clientId, label) => {
  await openClientActionsMenu(clientId);
  fireEvent.click(screen.getByTestId(`client-actions-${clientId}-item-${label}`));
};

const mockPeople = [
  {
    id: '1',
    name: 'João Silva',
    commonGroups: 'Grupo do WhatsApp',
    whatsapp: '5511999998888',
    instagram: 'https://instagram.com/joao',
    address: 'Rua das Flores, 123',
    isVip: true,
    isDoterraMember: true,
  },
  {
    id: '2',
    name: 'Maria Santos',
    commonGroups: null,
    whatsapp: 'joao@email.com',
    instagram: null,
    address: null,
    isVip: false,
    isDoterraMember: false,
  },
];

describe('PeoplePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render "Cadastro de Clientes"', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Cadastro de Clientes')).toBeInTheDocument();
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
        expect(screen.getByText('Nenhum cliente cadastrado')).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      mockGet.mockImplementation(() => new Promise(() => {}));
      renderPage();
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });
  });

  describe('People List', () => {
    it('should display people in a table with client fields', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
        expect(screen.getByText('Maria Santos')).toBeInTheDocument();
        expect(screen.getByText('Grupo do WhatsApp')).toBeInTheDocument();
        expect(screen.getByText('Rua das Flores, 123')).toBeInTheDocument();
      });
    });

    it('should render WhatsApp as a wa.me link for valid numbers', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await waitFor(() => {
        const link = screen.getByText('+55 (11) 99999-8888');
        expect(link.tagName).toBe('A');
        expect(link).toHaveAttribute('href', 'https://wa.me/5511999998888');
        expect(link).toHaveAttribute('target', '_blank');
      });
    });

    it('should render WhatsApp as plain text when out of pattern (legacy value)', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[1]] });
      renderPage();

      await waitFor(() => {
        const cell = screen.getByText('joao@email.com');
        expect(cell.tagName).not.toBe('A');
      });
    });

    it('should render Instagram as a clickable link', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await waitFor(() => {
        const link = screen.getByText('https://instagram.com/joao');
        expect(link.tagName).toBe('A');
        expect(link).toHaveAttribute('href', 'https://instagram.com/joao');
        expect(link).toHaveAttribute('target', '_blank');
      });
    });

    it('should render VIP and Membro doTERRA badges', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText('Sim')).toHaveLength(2);
        expect(screen.getAllByText('Não')).toHaveLength(2);
      });
    });

    it('should display one kebab trigger per row', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId(/client-actions-.*-trigger/)).toHaveLength(2);
      });
    });
  });

  describe('Create Client Modal', () => {
    it('should open modal when clicking "Novo"', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Novo'));

      await waitFor(() => {
        expect(screen.getByText('Novo Cliente')).toBeInTheDocument();
      });
    });

    it('should close modal when clicking "Fechar"', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      await waitFor(() => {
        expect(screen.getByText('Novo Cliente')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Fechar'));

      await waitFor(() => {
        expect(screen.queryByText('Novo Cliente')).not.toBeInTheDocument();
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

    it('should pre-fill WhatsApp with Brazilian country code +55', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const whatsappInput = await screen.findByPlaceholderText('+55 (11) 99999-8888');
      expect(whatsappInput.value).toBe('+55');
    });

    it('should mask WhatsApp as the user types', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const whatsappInput = await screen.findByPlaceholderText('+55 (11) 99999-8888');
      fireEvent.change(whatsappInput, { target: { value: '5511999998888' } });

      await waitFor(() => {
        expect(whatsappInput.value).toBe('+55 (11) 99999-8888');
      });
    });

    it('should show out-of-pattern warning for an invalid whatsapp', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const whatsappInput = await screen.findByPlaceholderText('+55 (11) 99999-8888');
      fireEvent.change(whatsappInput, { target: { value: '5511' } });

      await waitFor(() => {
        expect(
          screen.getByText(/Número fora do padrão/)
        ).toBeInTheDocument();
      });
    });

    it('should not show out-of-pattern warning for a valid whatsapp', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const whatsappInput = await screen.findByPlaceholderText('+55 (11) 99999-8888');
      fireEvent.change(whatsappInput, { target: { value: '5511999998888' } });

      await waitFor(() => {
        expect(screen.queryByText(/Número fora do padrão/)).not.toBeInTheDocument();
      });
    });

    it('should create client and call API with all fields', async () => {
      mockGet.mockResolvedValue({ data: [] });
      mockPost.mockResolvedValue({ data: { id: '3', name: 'Novo' } });

      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const nameInput = await screen.findByPlaceholderText('Digite o nome');
      const whatsappInput = screen.getByPlaceholderText('+55 (11) 99999-8888');
      const groupsInput = screen.getByPlaceholderText('Ex.: Grupo do WhatsApp, vizinho, família...');
      const instagramInput = screen.getByPlaceholderText('https://instagram.com/usuario');
      const addressInput = screen.getByPlaceholderText('Digite o endereço completo');

      fireEvent.change(nameInput, { target: { value: 'Novo' } });
      fireEvent.change(groupsInput, { target: { value: 'Família' } });
      fireEvent.change(whatsappInput, { target: { value: '5511999998888' } });
      fireEvent.change(instagramInput, { target: { value: 'https://instagram.com/novo' } });
      fireEvent.change(addressInput, { target: { value: 'Rua Nova, 1' } });
      fireEvent.change(screen.getByLabelText('Grupo VIP'), { target: { value: 'true' } });
      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/people', {
          name: 'Novo',
          whatsapp: '5511999998888',
          commonGroups: 'Família',
          instagram: 'https://instagram.com/novo',
          address: 'Rua Nova, 1',
          isVip: true,
          isDoterraMember: false,
        });
      });
    });
  });

  describe('Edit Client', () => {
    it('should open edit modal with pre-filled data', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      await clickClientAction('1', 'Editar');

      await waitFor(() => {
        expect(screen.getByText('Editar Cliente')).toBeInTheDocument();
        expect(screen.getByDisplayValue('João Silva')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Grupo do WhatsApp')).toBeInTheDocument();
        expect(screen.getByDisplayValue('+55 (11) 99999-8888')).toBeInTheDocument();
        expect(screen.getByDisplayValue('https://instagram.com/joao')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Rua das Flores, 123')).toBeInTheDocument();
      });
    });

    it('should show raw legacy whatsapp with out-of-pattern warning on edit', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[1]] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      });

      await clickClientAction('2', 'Editar');

      await waitFor(() => {
        expect(screen.getByDisplayValue('joao@email.com')).toBeInTheDocument();
        expect(screen.getByText(/Número fora do padrão/)).toBeInTheDocument();
      });
    });

    it('should call PUT API on form submit', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      mockPut.mockResolvedValue({ data: { id: '1', name: 'Updated' } });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      await clickClientAction('1', 'Editar');

      const nameInput = await screen.findByDisplayValue('João Silva');
      fireEvent.change(nameInput, { target: { value: 'Updated' } });
      fireEvent.change(screen.getByLabelText('Cadastrado/Membro doTERRA'), { target: { value: 'false' } });

      await waitFor(() => {
        expect(screen.getByText('Editar Cliente')).toBeInTheDocument();
      });

      const form = nameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPut).toHaveBeenCalledWith('/people/1', {
          name: 'Updated',
          whatsapp: '5511999998888',
          commonGroups: 'Grupo do WhatsApp',
          instagram: 'https://instagram.com/joao',
          address: 'Rua das Flores, 123',
          isVip: true,
          isDoterraMember: false,
        });
      });
    });
  });

  describe('Delete Person', () => {
    it('should delete when confirming', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      mockDelete.mockResolvedValue({ data: { message: 'Person deleted' } });
      window.confirm = vi.fn(() => true);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      await clickClientAction('1', 'Excluir');

      expect(window.confirm).toHaveBeenCalled();
      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('/people/1');
      });
    });

    it('should not delete when cancelling', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      window.confirm = vi.fn(() => false);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      await clickClientAction('1', 'Excluir');

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe('Action Menu (kebab)', () => {
    it('should render one kebab trigger per row', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId(/client-actions-.*-trigger/)).toHaveLength(2);
      });
    });

    it('should keep the menu hidden until the trigger is clicked', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('client-actions-1-trigger')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('client-actions-1-menu')).not.toBeInTheDocument();
    });

    it('should show Editar and Excluir items when the trigger is clicked', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await openClientActionsMenu('1');

      expect(screen.getByTestId('client-actions-1-item-Editar')).toHaveTextContent('Editar');
      expect(screen.getByTestId('client-actions-1-item-Excluir')).toHaveTextContent('Excluir');
    });

    it('should render the Excluir item with danger styling', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await openClientActionsMenu('1');

      const excluirItem = screen.getByTestId('client-actions-1-item-Excluir');
      expect(excluirItem.className).toMatch(/text-red-600/);
      expect(excluirItem.className).toMatch(/hover:bg-red/);
    });

    it('should expose correct a11y semantics on trigger, menu and items', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      const trigger = await screen.findByTestId('client-actions-1-trigger');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await openClientActionsMenu('1');

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('client-actions-1-menu')).toHaveAttribute('role', 'menu');
      expect(screen.getByTestId('client-actions-1-item-Editar')).toHaveAttribute('role', 'menuitem');
      expect(screen.getByTestId('client-actions-1-item-Excluir')).toHaveAttribute('role', 'menuitem');
    });

    it('should close the menu when clicking the backdrop', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await openClientActionsMenu('1');

      fireEvent.click(screen.getByTestId('client-actions-1-backdrop'));

      await waitFor(() => {
        expect(screen.queryByTestId('client-actions-1-menu')).not.toBeInTheDocument();
      });
    });

    it('should close the menu when pressing Escape', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await openClientActionsMenu('1');

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('client-actions-1-menu')).not.toBeInTheDocument();
      });
    });
  });
});
