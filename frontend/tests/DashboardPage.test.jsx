import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPage from '../src/pages/DashboardPage';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockExportExcel = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
  },
}));

vi.mock('../src/utils/exportExcel', () => ({
  exportExcel: (...args) => mockExportExcel(...args),
}));

const mockDashboardData = {
  totalPending: 1500.5,
  totalPaid: 3000.0,
  currentMonthReceipts: 750.25,
  personBalances: [
    { personName: 'João Silva', itemTotal: 2000, paymentTotal: 500 },
    { personName: 'Maria Santos', itemTotal: 1500, paymentTotal: 1500 },
  ],
};

const mockGetImplementation = (data = mockDashboardData) => {
  mockGet.mockImplementation((url) => {
    if (url === '/dashboard') return Promise.resolve({ data });
    if (url === '/orders') return Promise.resolve({ data: [] });
    if (url === '/people') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: {} });
  });
};

const renderPage = () => {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <DashboardPage />
      </ToastProvider>
    </MemoryRouter>
  );
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the page title "Dashboard"', async () => {
      mockGetImplementation();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      mockGet.mockImplementation(() => new Promise(() => {}));
      renderPage();
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });

    it('should show error message when API fails', async () => {
      mockGet.mockRejectedValue(new Error('Network Error'));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Erro ao carregar dados do dashboard. Tente novamente.')).toBeInTheDocument();
      });
    });

    it('should show session expired message on 401 error', async () => {
      mockGet.mockRejectedValue({ response: { status: 401 } });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Sessão expirada. Faça login novamente.')).toBeInTheDocument();
      });
    });
  });

  describe('KPI Widgets', () => {
    beforeEach(() => {
      mockGetImplementation();
    });

    it('should display "Total Pendente" KPI with emoji', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Total Pendente')).toBeInTheDocument();
      });
    });

    it('should display "Total Quitado" KPI with emoji', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Total Quitado')).toBeInTheDocument();
      });
    });

    it('should display "Recebimentos (Mês Atual)" KPI with emoji', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Recebimentos (Mês Atual)')).toBeInTheDocument();
      });
    });

    it('should display KPI values formatted as BRL currency', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/R\$\s*1\.500,50/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*3\.000,00/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*750,25/)).toBeInTheDocument();
      });
    });

    it('should display zero values when data is missing', async () => {
      mockGetImplementation({
        totalPending: 0,
        totalPaid: 0,
        currentMonthReceipts: 0,
        personBalances: [],
      });
      renderPage();
      await waitFor(() => {
        const zeroValues = screen.getAllByText(/R\$\s*0,00/);
        expect(zeroValues).toHaveLength(3);
      });
    });
  });

  describe('Chart', () => {
    it('should display "Saldos por Pessoa" section title when chart data exists', async () => {
      mockGetImplementation();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Saldos por Pessoa')).toBeInTheDocument();
      });
    });

    it('should show empty state when no person balances exist', async () => {
      mockGetImplementation({
        totalPending: 0,
        totalPaid: 0,
        currentMonthReceipts: 0,
        personBalances: [],
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Nenhum saldo por pessoa')).toBeInTheDocument();
      });
    });

    it('should render chart container when data exists', async () => {
      mockGetImplementation();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Saldos por Pessoa')).toBeInTheDocument();
        expect(document.querySelector('.recharts-responsive-container')).toBeInTheDocument();
      });
    });
  });

  describe('Export Button', () => {
    it('should render "Exportar para Excel" button', async () => {
      mockGetImplementation();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Exportar para Excel/)).toBeInTheDocument();
      });
    });

    it('should disable export button when no data (all KPIs zero, no personBalances)', async () => {
      mockGetImplementation({
        totalPending: 0,
        totalPaid: 0,
        currentMonthReceipts: 0,
        personBalances: [],
      });
      renderPage();
      await waitFor(() => {
        const btn = screen.getByText(/Exportar para Excel/).closest('button');
        expect(btn).toBeDisabled();
      });
    });

    it('should enable export button when data exists', async () => {
      mockGetImplementation();
      renderPage();
      await waitFor(() => {
        const btn = screen.getByText(/Exportar para Excel/).closest('button');
        expect(btn).not.toBeDisabled();
      });
    });

    it('should call exportExcel with fetched orders, people, and dashboard data on click', async () => {
      const mockOrders = [{ orderNumber: 'ORD-001', totalValue: '500.00' }];
      const mockPeople = [{ name: 'João Silva', contact: 'joao@email.com' }];

      mockGet.mockImplementation((url) => {
        if (url === '/dashboard') return Promise.resolve({ data: mockDashboardData });
        if (url === '/orders') return Promise.resolve({ data: mockOrders });
        if (url === '/people') return Promise.resolve({ data: mockPeople });
        return Promise.resolve({ data: {} });
      });
      mockExportExcel.mockImplementation(() => {});

      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Exportar para Excel/)).toBeInTheDocument();
      });

      const btn = screen.getByText(/Exportar para Excel/).closest('button');
      fireEvent.click(btn);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/orders');
        expect(mockGet).toHaveBeenCalledWith('/people');
        expect(mockGet).toHaveBeenCalledWith('/dashboard');
        expect(mockExportExcel).toHaveBeenCalledWith({
          orders: mockOrders,
          people: mockPeople,
          dashboard: mockDashboardData,
        });
      });
    });

    it('should show success toast "Relatório exportado com sucesso!" after successful export', async () => {
      mockGetImplementation();
      mockExportExcel.mockImplementation(() => {});

      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Exportar para Excel/)).toBeInTheDocument();
      });

      const btn = screen.getByText(/Exportar para Excel/).closest('button');
      fireEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByText('Relatório exportado com sucesso!')).toBeInTheDocument();
      });
    });

    it('should show error toast "Erro ao exportar relatório." when export fails', async () => {
      mockGet.mockImplementation((url) => {
        if (url === '/dashboard') return Promise.resolve({ data: mockDashboardData });
        if (url === '/orders') return Promise.reject(new Error('Network error'));
        if (url === '/people') return Promise.resolve({ data: [] });
        return Promise.resolve({ data: {} });
      });

      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Exportar para Excel/)).toBeInTheDocument();
      });

      const btn = screen.getByText(/Exportar para Excel/).closest('button');
      fireEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByText('Erro ao exportar relatório.')).toBeInTheDocument();
      });
    });

    it('should show "Exportando..." loading state while exporting', async () => {
      let resolveExport;
      mockGetImplementation();
      mockExportExcel.mockImplementation(() => new Promise((resolve) => { resolveExport = resolve; }));

      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Exportar para Excel/)).toBeInTheDocument();
      });

      const btn = screen.getByText(/Exportar para Excel/).closest('button');
      fireEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByText('Exportando...')).toBeInTheDocument();
        expect(btn).toBeDisabled();
      });

      resolveExport();

      await waitFor(() => {
        expect(screen.queryByText('Exportando...')).not.toBeInTheDocument();
      });
    });
  });
});
