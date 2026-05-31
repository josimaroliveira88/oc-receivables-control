import * as XLSX from 'xlsx';

const BRL_FORMAT = '#,##0.00';

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const setMonetaryCell = (ws, row, col, value) => {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  if (!ws[ref]) {
    ws[ref] = { t: 'n', v: parseFloat(value) || 0, z: BRL_FORMAT };
  } else {
    ws[ref].t = 'n';
    ws[ref].v = parseFloat(value) || 0;
    ws[ref].z = BRL_FORMAT;
  }
};

const buildPedidosSheet = (orders) => {
  const headers = ['Número', 'Data', 'Valor Total (R$)', 'Status'];
  const rows = orders.map((order) => ({
    'Número': order.orderNumber,
    'Data': formatDate(order.orderDate || order.createdAt),
    'Valor Total (R$)': parseFloat(order.totalValue) || 0,
    'Status': order.status,
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 12 }];

  for (let i = 1; i <= rows.length; i++) {
    setMonetaryCell(ws, i, 2, rows[i - 1]['Valor Total (R$)']);
  }

  return ws;
};

const buildPessoasSheet = (people) => {
  const headers = ['Nome', 'Contato'];
  const rows = people.map((person) => ({
    'Nome': person.name,
    'Contato': person.contact || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws['!cols'] = [{ wch: 30 }, { wch: 25 }];

  return ws;
};

const buildHistoricoSheet = (orders) => {
  const headers = ['Pedido', 'Pessoa', 'Valor (R$)', 'Data', 'Notas'];
  const rows = [];

  for (const order of orders) {
    if (!order.payments || order.payments.length === 0) continue;
    for (const payment of order.payments) {
      rows.push({
        'Pedido': order.orderNumber,
        'Pessoa': payment.person ? payment.person.name : 'Sem pessoa',
        'Valor (R$)': parseFloat(payment.amount) || 0,
        'Data': formatDate(payment.paidAt || payment.createdAt),
        'Notas': payment.notes || '',
      });
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 30 }];

  for (let i = 1; i <= rows.length; i++) {
    setMonetaryCell(ws, i, 2, rows[i - 1]['Valor (R$)']);
  }

  return ws;
};

const buildSaldoPendenteSheet = (personBalances) => {
  const headers = ['Pessoa', 'Total Itens (R$)', 'Total Pagamentos (R$)', 'Saldo Pendente (R$)'];
  const rows = (personBalances || []).map((p) => ({
    'Pessoa': p.personName,
    'Total Itens (R$)': parseFloat(p.itemTotal) || 0,
    'Total Pagamentos (R$)': parseFloat(p.paymentTotal) || 0,
    'Saldo Pendente (R$)': parseFloat(p.pending) || 0,
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 22 }, { wch: 20 }];

  for (let i = 1; i <= rows.length; i++) {
    setMonetaryCell(ws, i, 1, rows[i - 1]['Total Itens (R$)']);
    setMonetaryCell(ws, i, 2, rows[i - 1]['Total Pagamentos (R$)']);
    setMonetaryCell(ws, i, 3, rows[i - 1]['Saldo Pendente (R$)']);
  }

  return ws;
};

export const exportExcel = ({ orders, people, dashboard }) => {
  const wb = XLSX.utils.book_new();

  const wsPedidos = buildPedidosSheet(orders || []);
  XLSX.utils.book_append_sheet(wb, wsPedidos, 'Pedidos');

  const wsPessoas = buildPessoasSheet(people || []);
  XLSX.utils.book_append_sheet(wb, wsPessoas, 'Pessoas');

  const wsHistorico = buildHistoricoSheet(orders || []);
  XLSX.utils.book_append_sheet(wb, wsHistorico, 'Histórico de Pagamentos');

  const wsSaldo = buildSaldoPendenteSheet(dashboard?.personBalances || []);
  XLSX.utils.book_append_sheet(wb, wsSaldo, 'Saldo Pendente');

  XLSX.writeFile(wb, 'relatorio-recebiveis.xlsx');
};
