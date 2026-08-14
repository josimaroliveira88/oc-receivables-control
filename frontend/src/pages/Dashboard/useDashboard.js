import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { exportExcel } from '../../utils/exportExcel';
import { useToast } from '../../components/Toast';
import { hasDashboardData, buildChartData } from './utils/dashboardHelpers';

export function useDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const { addToast } = useToast();

  const fetchDashboard = useCallback(async () => {
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
  }, []);

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

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const canExport = hasDashboardData(data);
  const chartData = buildChartData(data?.personBalances);

  return {
    data,
    loading,
    error,
    exporting,
    handleExport,
    canExport,
    chartData,
  };
}
