import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PeoplePage from '../src/pages/PeoplePage';
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

const renderPage = () => {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <PeoplePage />
      </ToastProvider>
    </MemoryRouter>,
  );
};

const openClientActionsMenu = async (clientId) => {
  await waitFor(() => {
    expect(
      screen.getByTestId(`client-actions-${clientId}-trigger`),
    ).toBeInTheDocument();
  });
  fireEvent.click(screen.getByTestId(`client-actions-${clientId}-trigger`));
  await waitFor(() => {
    expect(
      screen.getByTestId(`client-actions-${clientId}-menu`),
    ).toBeInTheDocument();
  });
};

const clickClientAction = async (clientId, label) => {
  await openClientActionsMenu(clientId);
  fireEvent.click(
    screen.getByTestId(`client-actions-${clientId}-item-${label}`),
  );
};

const mockPeople = [
  {
    id: '1',
    name: 'João Silva',
    commonGroups: 'Grupo do WhatsApp',
    whatsapp: '5511999998888',
    instagram: 'https://instagram.com/joao',
    address: 'Rua das Flores, 123',
    observacao: 'Cliente prefere retirar pessoalmente.',
    birthday: '15/08',
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
    observacao: null,
    birthday: null,
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
        expect(
          screen.getByText('Nenhum cliente cadastrado'),
        ).toBeInTheDocument();
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
        expect(screen.getByText('15/08')).toBeInTheDocument();
        expect(
          screen.getByText('Cliente prefere retirar pessoalmente.'),
        ).toBeInTheDocument();
      });
    });

    it('should not render an Endereço column', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });
      expect(screen.queryByText('Rua das Flores, 123')).not.toBeInTheDocument();
      expect(screen.queryByText('Endereço')).not.toBeInTheDocument();
    });

    it('should render WhatsApp as a wa.me icon link for valid numbers', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await waitFor(() => {
        const link = screen.getByLabelText(
          'Abrir WhatsApp +55 (11) 99999-8888',
        );
        expect(link.tagName).toBe('A');
        expect(link).toHaveAttribute('href', 'https://wa.me/5511999998888');
        expect(link).toHaveAttribute('target', '_blank');
      });
    });

    it('should render a muted WhatsApp icon for out-of-pattern values', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[1]] });
      renderPage();

      await waitFor(() => {
        const icon = screen.getByLabelText('WhatsApp: joao@email.com');
        expect(icon.tagName).not.toBe('A');
      });
    });

    it('should render Instagram as a clickable icon link', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await waitFor(() => {
        const link = screen.getByLabelText(
          'Abrir Instagram https://instagram.com/joao',
        );
        expect(link.tagName).toBe('A');
        expect(link).toHaveAttribute('href', 'https://instagram.com/joao');
        expect(link).toHaveAttribute('target', '_blank');
      });
    });

    it('should render a dash when Instagram is missing', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[1]] });
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText('-').length).toBeGreaterThan(0);
      });
    });

    it('should highlight the whole row when the client has a birthday this month', async () => {
      const now = new Date();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const birthdayPerson = {
        ...mockPeople[0],
        id: '5',
        name: 'Aniversariante do Mês',
        birthday: `05/${currentMonth}`,
      };
      mockGet.mockResolvedValue({ data: [birthdayPerson, mockPeople[1]] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Aniversariante do Mês')).toBeInTheDocument();
      });

      const birthdayRow = screen
        .getByText('Aniversariante do Mês')
        .closest('tr');
      expect(birthdayRow.className).toMatch(/bg-amber-50/);

      const regularRow = screen.getByText('Maria Santos').closest('tr');
      expect(regularRow.className).not.toMatch(/bg-amber/);
    });

    it('should render a dash in the Aniversário column when there is no birthday', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[1]] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      });
      const cells = screen.getAllByText('-');
      expect(cells.length).toBeGreaterThan(0);
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
        expect(screen.getAllByTestId(/client-actions-.*-trigger/)).toHaveLength(
          2,
        );
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

    it('should render the form validation error inside the modal (not behind it)', async () => {
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

      const modal = document.querySelector('.fixed.inset-0.z-\\[60\\]');
      expect(modal).not.toBeNull();
      expect(within(modal).getByText('Nome é obrigatório')).toBeInTheDocument();
    });

    it('should clear the validation error once the name is typed', async () => {
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

      fireEvent.change(nameInput, { target: { value: 'Novo Cliente' } });

      expect(screen.queryByText('Nome é obrigatório')).not.toBeInTheDocument();
    });

    it('should show backend submit failure as a toast', async () => {
      mockGet.mockResolvedValue({ data: [] });
      mockPost.mockRejectedValue({
        response: {
          data: { error: 'Erro ao criar cliente. Tente novamente.' },
        },
      });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const nameInput = await screen.findByPlaceholderText('Digite o nome');
      fireEvent.change(nameInput, { target: { value: 'Novo Cliente' } });
      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(
          screen.getByText('Erro ao criar cliente. Tente novamente.'),
        ).toBeInTheDocument();
      });
    });

    it('should pre-fill WhatsApp with Brazilian country code +55', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const whatsappInput = await screen.findByPlaceholderText(
        '+55 (11) 99999-8888',
      );
      expect(whatsappInput.value).toBe('+55');
    });

    it('should mask WhatsApp as the user types', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const whatsappInput = await screen.findByPlaceholderText(
        '+55 (11) 99999-8888',
      );
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

      const whatsappInput = await screen.findByPlaceholderText(
        '+55 (11) 99999-8888',
      );
      fireEvent.change(whatsappInput, { target: { value: '5511' } });

      await waitFor(() => {
        expect(screen.getByText(/Número fora do padrão/)).toBeInTheDocument();
      });
    });

    it('should not show out-of-pattern warning for a valid whatsapp', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const whatsappInput = await screen.findByPlaceholderText(
        '+55 (11) 99999-8888',
      );
      fireEvent.change(whatsappInput, { target: { value: '5511999998888' } });

      await waitFor(() => {
        expect(
          screen.queryByText(/Número fora do padrão/),
        ).not.toBeInTheDocument();
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
      const groupsInput = screen.getByPlaceholderText(
        'Ex.: Grupo do WhatsApp, vizinho, família...',
      );
      const instagramInput = screen.getByPlaceholderText(
        'https://instagram.com/usuario',
      );
      const addressInput = screen.getByPlaceholderText(
        'Digite o endereço completo',
      );
      const birthdayInput = screen.getByPlaceholderText('DD/MM');
      const observacaoInput = screen.getByPlaceholderText(
        'Informações gerais sobre o cliente (até 2000 caracteres)',
      );

      fireEvent.change(nameInput, { target: { value: 'Novo' } });
      fireEvent.change(groupsInput, { target: { value: 'Família' } });
      fireEvent.change(whatsappInput, { target: { value: '5511999998888' } });
      fireEvent.change(instagramInput, {
        target: { value: 'https://instagram.com/novo' },
      });
      fireEvent.change(addressInput, { target: { value: 'Rua Nova, 1' } });
      fireEvent.change(birthdayInput, { target: { value: '1508' } });
      fireEvent.change(observacaoInput, {
        target: { value: 'Cliente novo no grupo.' },
      });
      fireEvent.change(screen.getByLabelText('Grupo VIP'), {
        target: { value: 'true' },
      });
      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/people', {
          name: 'Novo',
          whatsapp: '5511999998888',
          commonGroups: 'Família',
          instagram: 'https://instagram.com/novo',
          address: 'Rua Nova, 1',
          observacao: 'Cliente novo no grupo.',
          birthday: '15/08',
          isVip: true,
          isDoterraMember: false,
          isSelf: false,
        });
      });
    });

    it('should mask the birthday input as DD/MM', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const birthdayInput = await screen.findByPlaceholderText('DD/MM');
      fireEvent.change(birthdayInput, { target: { value: '3012' } });

      await waitFor(() => {
        expect(birthdayInput.value).toBe('30/12');
      });
    });

    it('should show a validation error for an invalid birthday', async () => {
      mockGet.mockResolvedValue({ data: [] });
      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const nameInput = await screen.findByPlaceholderText('Digite o nome');
      const birthdayInput = screen.getByPlaceholderText('DD/MM');
      fireEvent.change(nameInput, { target: { value: 'Cliente' } });
      fireEvent.change(birthdayInput, { target: { value: '31/02' } });

      const form = nameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Aniversário deve estar no formato DD/MM com data válida',
          ),
        ).toBeInTheDocument();
      });
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('should send isSelf true when "Esta pessoa sou eu" is checked', async () => {
      mockGet.mockResolvedValue({ data: [] });
      mockPost.mockResolvedValue({ data: { id: '3', name: 'Novo' } });

      renderPage();

      await waitFor(() => {
        fireEvent.click(screen.getByText('Novo'));
      });

      const nameInput = await screen.findByPlaceholderText('Digite o nome');
      fireEvent.change(nameInput, { target: { value: 'Eu' } });
      fireEvent.click(screen.getByLabelText('Esta pessoa sou eu'));

      fireEvent.click(screen.getByText('Salvar'));

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/people', {
          name: 'Eu',
          whatsapp: '55',
          commonGroups: null,
          instagram: null,
          address: null,
          observacao: null,
          birthday: null,
          isVip: false,
          isDoterraMember: false,
          isSelf: true,
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
        expect(
          screen.getByDisplayValue('Grupo do WhatsApp'),
        ).toBeInTheDocument();
        expect(
          screen.getByDisplayValue('+55 (11) 99999-8888'),
        ).toBeInTheDocument();
        expect(
          screen.getByDisplayValue('https://instagram.com/joao'),
        ).toBeInTheDocument();
        expect(
          screen.getByDisplayValue('Rua das Flores, 123'),
        ).toBeInTheDocument();
        expect(screen.getByDisplayValue('15/08')).toBeInTheDocument();
        expect(
          screen.getByDisplayValue('Cliente prefere retirar pessoalmente.'),
        ).toBeInTheDocument();
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
      fireEvent.change(screen.getByLabelText('Cadastrado/Membro doTERRA'), {
        target: { value: 'false' },
      });

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
          observacao: 'Cliente prefere retirar pessoalmente.',
          birthday: '15/08',
          isVip: true,
          isDoterraMember: false,
          isSelf: false,
        });
      });
    });
  });

  describe('Delete Person', () => {
    it('should delete when confirming', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      mockDelete.mockResolvedValue({ data: { message: 'Person deleted' } });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      await clickClientAction('1', 'Excluir');

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith('/people/1');
      });
    });

    it('should not delete when cancelling', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      await clickClientAction('1', 'Excluir');

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe('Client Details Modal', () => {
    const summaryData = {
      ordersCount: 2,
      totalItemsCents: 15000,
      totalPaidCents: 6000,
      totalOpenCents: 9000,
    };
    const zeroSummary = {
      ordersCount: 0,
      totalItemsCents: 0,
      totalPaidCents: 0,
      totalOpenCents: 0,
    };

    const mockWithSummary = (summary) =>
      mockGet.mockImplementation((url) => {
        if (url.includes('/summary')) {
          return Promise.resolve({ data: summary });
        }
        return Promise.resolve({ data: [mockPeople[0]] });
      });

    it('should open the details modal with client data and financial summary', async () => {
      mockWithSummary(summaryData);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      await clickClientAction('1', 'Detalhes');

      await waitFor(() => {
        expect(screen.getByText('Detalhes do Cliente')).toBeInTheDocument();
      });
      const modal = within(screen.getByTestId('client-details-modal'));
      expect(modal.getByText('15/08')).toBeInTheDocument();
      expect(modal.getByText('Rua das Flores, 123')).toBeInTheDocument();
      expect(modal.getByText('R$ 150,00')).toBeInTheDocument();
      expect(modal.getByText('R$ 60,00')).toBeInTheDocument();
      expect(modal.getByText('R$ 90,00')).toBeInTheDocument();
      expect(modal.getByTestId('client-summary-orders')).toHaveTextContent('2');
    });

    it('should show WhatsApp and Instagram links in the details modal', async () => {
      mockWithSummary(zeroSummary);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      await clickClientAction('1', 'Detalhes');

      await waitFor(() => {
        expect(screen.getByText('Detalhes do Cliente')).toBeInTheDocument();
      });
      expect(screen.getByText('+55 (11) 99999-8888')).toBeInTheDocument();
      expect(
        screen.getByText('https://instagram.com/joao'),
      ).toBeInTheDocument();
    });

    it('should close the details modal when clicking Fechar', async () => {
      mockWithSummary(zeroSummary);
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      await clickClientAction('1', 'Detalhes');

      await waitFor(() => {
        expect(screen.getByText('Detalhes do Cliente')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Fechar'));

      await waitFor(() => {
        expect(
          screen.queryByText('Detalhes do Cliente'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Action Menu (kebab)', () => {
    it('should render one kebab trigger per row', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId(/client-actions-.*-trigger/)).toHaveLength(
          2,
        );
      });
    });

    it('should keep the menu hidden until the trigger is clicked', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await waitFor(() => {
        expect(
          screen.getByTestId('client-actions-1-trigger'),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId('client-actions-1-menu'),
      ).not.toBeInTheDocument();
    });

    it('should show Detalhes, Editar and Excluir items when the trigger is clicked', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await openClientActionsMenu('1');

      expect(
        screen.getByTestId('client-actions-1-item-Detalhes'),
      ).toHaveTextContent('Detalhes');
      expect(
        screen.getByTestId('client-actions-1-item-Editar'),
      ).toHaveTextContent('Editar');
      expect(
        screen.getByTestId('client-actions-1-item-Excluir'),
      ).toHaveTextContent('Excluir');
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
      expect(screen.getByTestId('client-actions-1-menu')).toHaveAttribute(
        'role',
        'menu',
      );
      expect(
        screen.getByTestId('client-actions-1-item-Editar'),
      ).toHaveAttribute('role', 'menuitem');
      expect(
        screen.getByTestId('client-actions-1-item-Excluir'),
      ).toHaveAttribute('role', 'menuitem');
    });

    it('should close the menu when clicking the backdrop', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await openClientActionsMenu('1');

      fireEvent.click(screen.getByTestId('client-actions-1-backdrop'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('client-actions-1-menu'),
        ).not.toBeInTheDocument();
      });
    });

    it('should close the menu when pressing Escape', async () => {
      mockGet.mockResolvedValue({ data: [mockPeople[0]] });
      renderPage();

      await openClientActionsMenu('1');

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(
          screen.queryByTestId('client-actions-1-menu'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Search, classification and sorting', () => {
    const morePeople = [
      ...mockPeople,
      {
        id: '3',
        name: 'Ana Souza',
        commonGroups: null,
        whatsapp: '5511888887777',
        instagram: null,
        address: null,
        isVip: false,
        isDoterraMember: true,
      },
    ];

    it('should filter people by name as the user types', async () => {
      mockGet.mockResolvedValue({ data: morePeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText(
          'Buscar por nome, WhatsApp ou Observação...',
        ),
        {
          target: { value: 'Ana' },
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Ana Souza')).toBeInTheDocument();
        expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
      });
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should filter people by WhatsApp digits', async () => {
      mockGet.mockResolvedValue({ data: morePeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText(
          'Buscar por nome, WhatsApp ou Observação...',
        ),
        {
          target: { value: '88887777' },
        },
      );

      await waitFor(() => {
        expect(screen.getByText('Ana Souza')).toBeInTheDocument();
        expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
      });
    });

    it('should filter people by Observação', async () => {
      mockGet.mockResolvedValue({ data: morePeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText(
          'Buscar por nome, WhatsApp ou Observação...',
        ),
        {
          target: { value: 'retirar' },
        },
      );

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
        expect(screen.queryByText('Maria Santos')).not.toBeInTheDocument();
        expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
      });
    });

    it('should filter by VIP classification', async () => {
      const vipOnlyPeople = [
        {
          id: '10',
          name: 'Vip Cliente',
          commonGroups: null,
          whatsapp: '5511900001111',
          instagram: null,
          address: null,
          isVip: true,
          isDoterraMember: false,
        },
        {
          id: '11',
          name: 'Membro Cliente',
          commonGroups: null,
          whatsapp: '5511900002222',
          instagram: null,
          address: null,
          isVip: false,
          isDoterraMember: true,
        },
      ];
      mockGet.mockResolvedValue({ data: vipOnlyPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Vip Cliente')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Classificação'), {
        target: { value: 'vip' },
      });

      await waitFor(() => {
        expect(screen.getByText('Vip Cliente')).toBeInTheDocument();
        expect(screen.queryByText('Membro Cliente')).not.toBeInTheDocument();
      });
    });

    it('should filter by Membro doTERRA classification', async () => {
      mockGet.mockResolvedValue({ data: morePeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText('Classificação'), {
        target: { value: 'member' },
      });

      await waitFor(() => {
        expect(screen.getByText('Ana Souza')).toBeInTheDocument();
        expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
      });
    });

    it('should show the filtered empty state when no person matches', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText(
          'Buscar por nome, WhatsApp ou Observação...',
        ),
        {
          target: { value: 'NãoExiste' },
        },
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            'Nenhum cliente encontrado para os filtros aplicados.',
          ),
        ).toBeInTheDocument();
      });
    });

    it('should not render sortable headers for WhatsApp and Instagram', async () => {
      mockGet.mockResolvedValue({ data: morePeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const whatsappHeader = screen.getByRole('columnheader', {
        name: /whatsapp/i,
      });
      const instagramHeader = screen.getByRole('columnheader', {
        name: /instagram/i,
      });
      for (const header of [whatsappHeader, instagramHeader]) {
        expect(header).not.toHaveAttribute('aria-sort');
        expect(within(header).queryByRole('button')).not.toBeInTheDocument();
      }
    });

    it('should not render a sort button on the Aniversário header', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const header = screen.getByRole('columnheader', {
        name: /aniversário/i,
      });
      expect(header).not.toHaveAttribute('aria-sort');
      expect(within(header).queryByRole('button')).not.toBeInTheDocument();
    });

    describe('Aniversariantes do mês toggle', () => {
      it('should render the toggle button next to "Novo"', async () => {
        mockGet.mockResolvedValue({ data: mockPeople });
        renderPage();

        await waitFor(() => {
          expect(screen.getByText('João Silva')).toBeInTheDocument();
        });

        const toggle = screen.getByTestId('toggle-birthday-month');
        expect(toggle).toHaveAttribute('aria-pressed', 'false');
        expect(toggle).toHaveTextContent(/aniversariantes do mês/i);
        expect(
          screen.getByRole('button', { name: /novo/i }),
        ).toBeInTheDocument();
      });

      it('should filter the list to people with a birthday in the current month', async () => {
        const now = new Date();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const people = [
          {
            id: '40',
            name: 'Aniversariante Atual',
            birthday: `05/${currentMonth}`,
          },
          {
            id: '41',
            name: 'Outro Mês',
            birthday: '05/01',
          },
          {
            id: '42',
            name: 'Sem Aniversário',
            birthday: null,
          },
        ];
        mockGet.mockResolvedValue({ data: people });
        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Aniversariante Atual')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('toggle-birthday-month'));

        await waitFor(() => {
          expect(screen.getByTestId('toggle-birthday-month')).toHaveAttribute(
            'aria-pressed',
            'true',
          );
          expect(screen.getByText('Aniversariante Atual')).toBeInTheDocument();
          expect(screen.queryByText('Outro Mês')).not.toBeInTheDocument();
          expect(screen.queryByText('Sem Aniversário')).not.toBeInTheDocument();
        });
      });

      it('should toggle the filter off and restore the full list', async () => {
        const now = new Date();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        mockGet.mockResolvedValue({
          data: [
            {
              id: '50',
              name: 'Aniversariante Atual',
              birthday: `05/${currentMonth}`,
            },
            { id: '51', name: 'Outro Mês', birthday: '05/01' },
          ],
        });
        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Aniversariante Atual')).toBeInTheDocument();
        });

        const toggle = screen.getByTestId('toggle-birthday-month');
        fireEvent.click(toggle);
        await waitFor(() => {
          expect(toggle).toHaveAttribute('aria-pressed', 'true');
          expect(screen.queryByText('Outro Mês')).not.toBeInTheDocument();
        });

        fireEvent.click(toggle);
        await waitFor(() => {
          expect(toggle).toHaveAttribute('aria-pressed', 'false');
          expect(screen.getByText('Outro Mês')).toBeInTheDocument();
          expect(screen.getByText('Aniversariante Atual')).toBeInTheDocument();
        });
      });
    });

    it('should render Aniversário header without all-caps styling', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const header = screen.getByRole('columnheader', {
        name: /aniversário/i,
      });
      expect(header.className).not.toMatch(/\buppercase\b/);
    });

    it('should render Observação and Ações headers without all-caps styling', async () => {
      mockGet.mockResolvedValue({ data: mockPeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const observacaoHeader = screen.getByRole('columnheader', {
        name: /observação/i,
      });
      const acoesHeader = screen.getByRole('columnheader', {
        name: /ações/i,
      });
      expect(observacaoHeader.className).not.toMatch(/\buppercase\b/);
      expect(acoesHeader.className).not.toMatch(/\buppercase\b/);
    });

    it('should sort by name descending when the header is clicked twice', async () => {
      mockGet.mockResolvedValue({ data: morePeople });
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('João Silva')).toBeInTheDocument();
      });

      const header = screen.getByTestId('people-sort-name');
      const nameHeader = header.closest('th');
      expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
      fireEvent.click(header);
      await waitFor(() => {
        expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
      });
      fireEvent.click(header);
      await waitFor(() => {
        expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
      });

      const names = document.querySelectorAll('tbody tr td[data-label="Nome"]');
      const nameTexts = Array.from(names).map((td) => td.textContent.trim());
      expect(nameTexts).toEqual(['Ana Souza', 'João Silva', 'Maria Santos']);
    });
  });
});
