import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatBRL } from '../utils/money';
import { exportExcel } from '../utils/exportExcel';
import { useToast } from '../components/Toast';
import { Circle, CheckCircle, DollarSign, Download } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const brlTooltipFormatter = (value) => formatBRL(value);

const brlTickFormatter = (value) => {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return `R$ ${value}`;
};

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const response = await api.get('/dashboard');
        setData(response.data);
      } catch (err) {
        if (err.response?.status === 401) {
          setError('Sessão expirada. Faça login novamente.');
        } else {
          setError('Erro ao carregar dados do dashboard. Tente novamente.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const hasData = data && (
    (data.personBalances && data.personBalances.length > 0) ||
    data.totalPending > 0 ||
    data.totalPaid > 0 ||
    data.currentMonthReceipts > 0
  );

  const handleExport = async () => {
    try {
      setExporting(true);
      const [ordersRes, peopleRes, dashboardRes] = await Promise.all([
        api.get('/orders'),
        api.get('/people'),
        api.get('/dashboard'),
      ]);
      exportExcel({
        orders: ordersRes.data,
        people: peopleRes.data,
        dashboard: dashboardRes.data,
      });
      addToast('Relatório exportado com sucesso!', 'success');
    } catch (err) {
      addToast('Erro ao exportar relatório.', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-500 dark:text-gray-400">Carregando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border-t-4 border-primary-600 dark:border-primary-400">
        <div className="p-6">
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total Pendente',
      value: data?.totalPending || 0,
      icon: Circle,
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-400',
      iconColor: 'text-red-500 dark:text-red-400',
      fill: 'fill-red-500 dark:fill-red-400',
    },
    {
      label: 'Total Quitado',
      value: data?.totalPaid || 0,
      icon: CheckCircle,
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-400',
      iconColor: 'text-green-500 dark:text-green-400',
    },
    {
      label: 'Recebimentos (Mês Atual)',
      value: data?.currentMonthReceipts || 0,
      icon: DollarSign,
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-400',
      iconColor: 'text-blue-500 dark:text-blue-400',
    },
  ];

  const chartData = (data?.personBalances || []).map((p) => ({
    name: p.personName,
    Itens: p.itemTotal,
    Pagamentos: p.paymentTotal,
  }));

  const hasChartData = chartData.length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border-t-4 border-primary-600 dark:border-primary-400">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Dashboard</h2>
          <button
            onClick={handleExport}
            disabled={exporting || !hasData}
            className="px-4 py-2 bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 disabled:from-primary-400 disabled:to-primary-300 text-white text-sm font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {exporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Exportando...
              </>
            ) : (
              <><Download className="w-4 h-4" /> Exportar para Excel</>
            )}
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className={`p-4 rounded-lg border ${kpi.bg} ${kpi.border}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {kpi.fill ? (
                      <Icon className={`w-5 h-5 ${kpi.iconColor} ${kpi.fill}`} />
                    ) : (
                      <Icon className={`w-5 h-5 ${kpi.iconColor}`} />
                    )}
                    <span className={`text-sm font-medium ${kpi.text}`}>
                      {kpi.label}
                    </span>
                  </div>
                  <p className={`text-2xl font-bold ${kpi.text}`}>
                    {formatBRL(kpi.value)}
                  </p>
                </div>
              );
            })}
          </div>

          {hasChartData ? (
            <div>
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                Saldos por Pessoa
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" />
                  <YAxis tickFormatter={brlTickFormatter} stroke="#9CA3AF" />
                  <Tooltip formatter={brlTooltipFormatter} />
                  <Legend />
                  <Bar dataKey="Itens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pagamentos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Nenhum saldo por pessoa</p>
            </div>
          )}

          {(data?.yearlyBreakdown && data.yearlyBreakdown.length > 0) ? (
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                Resumo por Ano
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="yearly-breakdown">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Ano</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Pendente</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Quitado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.yearlyBreakdown.map((yearData) => (
                      <tr key={yearData.year} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                        <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">{yearData.year}</td>
                        <td className="py-3 px-4 text-right text-red-600 dark:text-red-400 font-medium">
                          {formatBRL(yearData.totalPending)}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 dark:text-green-400 font-medium">
                          {formatBRL(yearData.totalQuitado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 mt-8">
              <p className="text-gray-500 dark:text-gray-400">Nenhum dado por ano</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
