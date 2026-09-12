import React, { useMemo } from 'react';
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
import { useTheme } from '../../../context/ThemeContext';
import {
  brlTooltipFormatter,
  brlTickFormatter,
} from '../utils/dashboardHelpers';

const FALLBACK = {
  grid: '#b996a4',
  axis: '#8a6b76',
  accent: '#d6336c',
  success: '#1e7a45',
  surface: '#ffffff',
  ink: '#2d1b24',
  line: '#f0dbe4',
};

const readToken = (name, fallback) => {
  if (typeof window === 'undefined' || !window.getComputedStyle)
    return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
};

const BalanceChart = ({ chartData }) => {
  const { theme } = useTheme();

  // Recompute the palette whenever the active theme changes so the chart
  // respects the light/dark design tokens.
  const colors = useMemo(
    () => ({
      grid: readToken('--text-tertiary', FALLBACK.grid),
      axis: readToken('--text-secondary', FALLBACK.axis),
      accent: readToken('--accent', FALLBACK.accent),
      success: readToken('--success-fg', FALLBACK.success),
      surface: readToken('--bg-surface', FALLBACK.surface),
      ink: readToken('--text-primary', FALLBACK.ink),
      line: readToken('--border', FALLBACK.line),
    }),
    [theme],
  );

  if (chartData.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-faint">Nenhum saldo por pessoa</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-ink-soft mb-4">
        Saldos por Pessoa
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="name"
            stroke={colors.axis}
            tick={{ fill: colors.axis }}
          />
          <YAxis
            tickFormatter={brlTickFormatter}
            stroke={colors.axis}
            tick={{ fill: colors.axis }}
          />
          <Tooltip
            formatter={brlTooltipFormatter}
            contentStyle={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.line}`,
              color: colors.ink,
            }}
          />
          <Legend wrapperStyle={{ color: colors.ink }} />
          <Bar dataKey="Itens" fill={colors.accent} radius={[4, 4, 0, 0]} />
          <Bar
            dataKey="Pagamentos"
            fill={colors.success}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BalanceChart;
