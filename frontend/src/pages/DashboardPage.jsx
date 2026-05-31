import React, { useState, useEffect } from 'react';
import api from '../services/api';
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

const formatBRL = (value) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-500">Carregando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total Pendente',
      value: data?.totalPending || 0,
      icon: '🔴',
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
    },
    {
      label: 'Total Quitado',
      value: data?.totalPaid || 0,
      icon: '✅',
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
    },
    {
      label: 'Recebimentos (Mês Atual)',
      value: data?.currentMonthReceipts || 0,
      icon: '💰',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
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
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className={`p-4 rounded-lg border ${kpi.bg} ${kpi.border}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{kpi.icon}</span>
                  <span className={`text-sm font-medium ${kpi.text}`}>
                    {kpi.label}
                  </span>
                </div>
                <p className={`text-2xl font-bold ${kpi.text}`}>
                  {formatBRL(kpi.value)}
                </p>
              </div>
            ))}
          </div>

          {hasChartData ? (
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4">
                Saldos por Pessoa
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={brlTickFormatter} />
                  <Tooltip formatter={brlTooltipFormatter} />
                  <Legend />
                  <Bar dataKey="Itens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pagamentos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Nenhum saldo por pessoa</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
