import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';

vi.mock('xlsx', async () => {
  const actual = await vi.importActual('xlsx');
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

const { exportExcel } = await import('../src/utils/exportExcel');

const mockOrders = [
  {
    orderNumber: 'ORD-001',
    orderDate: '2024-03-15T10:30:00.000Z',
    createdAt: '2024-03-15T10:30:00.000Z',
    totalValue: '1500.50',
    status: 'PENDENTE',
    payments: [
      {
        person: { name: 'João Silva' },
        amount: '500.25',
        paidAt: '2024-04-10T14:00:00.000Z',
        createdAt: '2024-04-10T14:00:00.000Z',
        notes: 'Primeira parcela',
      },
    ],
  },
  {
    orderNumber: 'ORD-002',
    orderDate: '2024-05-20T08:00:00.000Z',
    createdAt: '2024-05-20T08:00:00.000Z',
    totalValue: '3000.00',
    status: 'QUITADO',
    payments: [],
  },
];

const mockPeople = [
  { name: 'João Silva', contact: 'joao@email.com' },
  { name: 'Maria Santos', contact: null },
];

const mockDashboard = {
  totalPending: 1500.5,
  totalPaid: 3000.0,
  currentMonthReceipts: 750.25,
  personBalances: [
    { personName: 'João Silva', itemTotal: '2000.00', paymentTotal: '500.25', pending: '1499.75' },
    { personName: 'Maria Santos', itemTotal: '1500.00', paymentTotal: '1500.00', pending: '0.00' },
  ],
};

describe('exportExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Workbook Structure', () => {
    it('should create a workbook with 4 sheets', () => {
      exportExcel({ orders: mockOrders, people: mockPeople, dashboard: mockDashboard });

      const writeFileCalls = XLSX.writeFile.mock.calls;
      expect(writeFileCalls).toHaveLength(1);

      const wb = writeFileCalls[0][0];
      expect(wb.SheetNames).toHaveLength(4);
    });

    it('should have sheet names: Pedidos, Pessoas, Histórico de Pagamentos, Saldo Pendente', () => {
      exportExcel({ orders: mockOrders, people: mockPeople, dashboard: mockDashboard });

      const wb = XLSX.writeFile.mock.calls[0][0];
      expect(wb.SheetNames).toEqual([
        'Pedidos',
        'Pessoas',
        'Histórico de Pagamentos',
        'Saldo Pendente',
      ]);
    });

    it('should call XLSX.writeFile with filename "relatorio-recebiveis.xlsx"', () => {
      exportExcel({ orders: mockOrders, people: mockPeople, dashboard: mockDashboard });

      expect(XLSX.writeFile).toHaveBeenCalledWith(
        expect.anything(),
        'relatorio-recebiveis.xlsx'
      );
    });
  });

  describe('Pedidos Sheet', () => {
    it('should have correct headers', () => {
      exportExcel({ orders: mockOrders, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Pedidos'];
      const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0];

      expect(headers).toEqual(['Número', 'Data', 'Valor Total (R$)', 'Status']);
    });

    it('should populate order rows with correct data', () => {
      exportExcel({ orders: mockOrders, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Pedidos'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows).toHaveLength(3);
      expect(rows[1][0]).toBe('ORD-001');
      expect(rows[1][3]).toBe('PENDENTE');
      expect(rows[2][0]).toBe('ORD-002');
      expect(rows[2][3]).toBe('QUITADO');
    });

    it('should format order dates as DD/MM/YYYY', () => {
      exportExcel({ orders: mockOrders, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Pedidos'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows[1][1]).toBe('15/03/2024');
      expect(rows[2][1]).toBe('20/05/2024');
    });

    it('should format monetary cells as numbers with BRL format', () => {
      exportExcel({ orders: mockOrders, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Pedidos'];

      const cellRef = XLSX.utils.encode_cell({ r: 1, c: 2 });
      const cell = ws[cellRef];

      expect(cell.t).toBe('n');
      expect(cell.v).toBe(1500.5);
      expect(cell.z).toBe('#,##0.00');
    });
  });

  describe('Pessoas Sheet', () => {
    it('should have correct headers', () => {
      exportExcel({ orders: [], people: mockPeople, dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Pessoas'];
      const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0];

      expect(headers).toEqual(['Nome', 'Contato']);
    });

    it('should populate person rows with correct data', () => {
      exportExcel({ orders: [], people: mockPeople, dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Pessoas'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows).toHaveLength(3);
      expect(rows[1][0]).toBe('João Silva');
      expect(rows[1][1]).toBe('joao@email.com');
      expect(rows[2][0]).toBe('Maria Santos');
    });

    it('should show empty string for null contact', () => {
      exportExcel({ orders: [], people: mockPeople, dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Pessoas'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows[2][1]).toBe('');
    });
  });

  describe('Histórico de Pagamentos Sheet', () => {
    it('should have correct headers', () => {
      exportExcel({ orders: mockOrders, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Histórico de Pagamentos'];
      const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0];

      expect(headers).toEqual(['Pedido', 'Pessoa', 'Valor (R$)', 'Data', 'Notas']);
    });

    it('should include payment rows from orders with payments', () => {
      exportExcel({ orders: mockOrders, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Histórico de Pagamentos'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows).toHaveLength(2);
      expect(rows[1][0]).toBe('ORD-001');
      expect(rows[1][1]).toBe('João Silva');
    });

    it('should format payment amounts as numbers with BRL format', () => {
      exportExcel({ orders: mockOrders, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Histórico de Pagamentos'];

      const cellRef = XLSX.utils.encode_cell({ r: 1, c: 2 });
      const cell = ws[cellRef];

      expect(cell.t).toBe('n');
      expect(cell.v).toBe(500.25);
      expect(cell.z).toBe('#,##0.00');
    });

    it('should format payment dates as DD/MM/YYYY', () => {
      exportExcel({ orders: mockOrders, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Histórico de Pagamentos'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows[1][3]).toBe('10/04/2024');
    });

    it('should include notes field', () => {
      exportExcel({ orders: mockOrders, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Histórico de Pagamentos'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows[1][4]).toBe('Primeira parcela');
    });

    it('should display "Sem pessoa" when payment has no person', () => {
      const ordersWithDeletedPerson = [
        {
          orderNumber: 'ORD-003',
          orderDate: '2024-06-01T00:00:00.000Z',
          createdAt: '2024-06-01T00:00:00.000Z',
          totalValue: '100.00',
          status: 'QUITADO',
          payments: [
            {
              person: null,
              amount: '100.00',
              paidAt: '2024-06-10T00:00:00.000Z',
              createdAt: '2024-06-10T00:00:00.000Z',
              notes: '',
            },
          ],
        },
      ];

      exportExcel({ orders: ordersWithDeletedPerson, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Histórico de Pagamentos'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows[1][1]).toBe('Sem pessoa');
    });

    it('should skip orders with no payments', () => {
      const ordersNoPayments = [
        {
          orderNumber: 'ORD-004',
          orderDate: '2024-07-01T00:00:00.000Z',
          createdAt: '2024-07-01T00:00:00.000Z',
          totalValue: '200.00',
          status: 'PENDENTE',
          payments: [],
        },
      ];

      exportExcel({ orders: ordersNoPayments, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Histórico de Pagamentos'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows).toHaveLength(1);
    });
  });

  describe('Saldo Pendente Sheet', () => {
    it('should have correct headers', () => {
      exportExcel({ orders: [], people: [], dashboard: mockDashboard });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Saldo Pendente'];
      const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0];

      expect(headers).toEqual(['Pessoa', 'Total Itens (R$)', 'Total Pagamentos (R$)', 'Saldo Pendente (R$)']);
    });

    it('should populate person balance rows', () => {
      exportExcel({ orders: [], people: [], dashboard: mockDashboard });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Saldo Pendente'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows).toHaveLength(3);
      expect(rows[1][0]).toBe('João Silva');
      expect(rows[2][0]).toBe('Maria Santos');
    });

    it('should format all monetary columns as numbers with BRL format', () => {
      exportExcel({ orders: [], people: [], dashboard: mockDashboard });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Saldo Pendente'];

      const itemTotalCell = ws[XLSX.utils.encode_cell({ r: 1, c: 1 })];
      const paymentTotalCell = ws[XLSX.utils.encode_cell({ r: 1, c: 2 })];
      const pendingCell = ws[XLSX.utils.encode_cell({ r: 1, c: 3 })];

      expect(itemTotalCell.t).toBe('n');
      expect(itemTotalCell.v).toBe(2000);
      expect(itemTotalCell.z).toBe('#,##0.00');

      expect(paymentTotalCell.t).toBe('n');
      expect(paymentTotalCell.v).toBe(500.25);
      expect(paymentTotalCell.z).toBe('#,##0.00');

      expect(pendingCell.t).toBe('n');
      expect(pendingCell.v).toBe(1499.75);
      expect(pendingCell.z).toBe('#,##0.00');
    });

    it('should handle string monetary values from Prisma Decimal', () => {
      const dashboardStringValues = {
        personBalances: [
          { personName: 'Test', itemTotal: '1234.56', paymentTotal: '1233.00', pending: '1.56' },
        ],
      };

      exportExcel({ orders: [], people: [], dashboard: dashboardStringValues });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Saldo Pendente'];

      const pendingCell = ws[XLSX.utils.encode_cell({ r: 1, c: 3 })];
      expect(pendingCell.t).toBe('n');
      expect(pendingCell.v).toBe(1.56);
    });
  });

  describe('Empty Data Handling', () => {
    it('should create all 4 sheets even with empty orders', () => {
      exportExcel({ orders: [], people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      expect(wb.SheetNames).toHaveLength(4);
    });

    it('should create Pedidos sheet with only headers when no orders', () => {
      exportExcel({ orders: [], people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Pedidos'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(['Número', 'Data', 'Valor Total (R$)', 'Status']);
    });

    it('should create Pessoas sheet with only headers when no people', () => {
      exportExcel({ orders: [], people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Pessoas'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(['Nome', 'Contato']);
    });

    it('should create Histórico sheet with only headers when no payments exist', () => {
      exportExcel({ orders: [], people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Histórico de Pagamentos'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows).toHaveLength(1);
    });

    it('should create Saldo Pendente sheet with only headers when no personBalances', () => {
      exportExcel({ orders: [], people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Saldo Pendente'];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      expect(rows).toHaveLength(1);
    });

    it('should handle null/undefined inputs gracefully', () => {
      exportExcel({ orders: null, people: null, dashboard: null });

      const wb = XLSX.writeFile.mock.calls[0][0];
      expect(wb.SheetNames).toHaveLength(4);
    });
  });

  describe('Column Widths', () => {
    it('should set column widths on Pedidos sheet', () => {
      exportExcel({ orders: mockOrders, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Pedidos'];

      expect(ws['!cols']).toBeDefined();
      expect(ws['!cols'].length).toBe(4);
    });

    it('should set column widths on Pessoas sheet', () => {
      exportExcel({ orders: [], people: mockPeople, dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Pessoas'];

      expect(ws['!cols']).toBeDefined();
      expect(ws['!cols'].length).toBe(2);
    });

    it('should set column widths on Histórico de Pagamentos sheet', () => {
      exportExcel({ orders: mockOrders, people: [], dashboard: { personBalances: [] } });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Histórico de Pagamentos'];

      expect(ws['!cols']).toBeDefined();
      expect(ws['!cols'].length).toBe(5);
    });

    it('should set column widths on Saldo Pendente sheet', () => {
      exportExcel({ orders: [], people: [], dashboard: mockDashboard });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Saldo Pendente'];

      expect(ws['!cols']).toBeDefined();
      expect(ws['!cols'].length).toBe(4);
    });
  });

  describe('Floating-Point Precision in Monetary Cells', () => {
    it('should correctly format 1234.56 - 1233 = 1.56 pending balance without FP errors', () => {
      const dashboardFP = {
        personBalances: [
          { personName: 'Precision Test', itemTotal: '1234.56', paymentTotal: '1233.00', pending: '1.56' },
        ],
      };

      exportExcel({ orders: [], people: [], dashboard: dashboardFP });

      const wb = XLSX.writeFile.mock.calls[0][0];
      const ws = wb.Sheets['Saldo Pendente'];

      const pendingCell = ws[XLSX.utils.encode_cell({ r: 1, c: 3 })];
      expect(pendingCell.v).toBe(1.56);
      expect(pendingCell.z).toBe('#,##0.00');
    });
  });
});
