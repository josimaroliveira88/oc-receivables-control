/* eslint-disable react/prop-types */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider } from '../src/context/ThemeContext';
import BalanceChart from '../src/pages/Dashboard/components/BalanceChart';

const { bars } = vi.hoisted(() => ({ bars: [] }));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: (props) => {
    bars.push(props);
    return <div data-testid={`bar-${props.dataKey}`} />;
  },
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const chartData = [
  { name: 'João', Itens: 2000, Pagamentos: 500 },
  { name: 'Maria', Itens: 1500, Pagamentos: 1500 },
];

const renderChart = () =>
  render(
    <ThemeProvider>
      <BalanceChart chartData={chartData} />
    </ThemeProvider>,
  );

const mockTokens = (tokens) => {
  window.getComputedStyle = vi.fn(() => ({
    getPropertyValue: (name) => tokens[name] || '',
  }));
};

describe('BalanceChart', () => {
  beforeEach(() => {
    bars.length = 0;
    document.documentElement.classList.remove('dark');
    localStorage.clear();
    mockTokens({
      '--accent': '#d6336c',
      '--success-fg': '#1e7a45',
      '--text-secondary': '#8a6b76',
      '--text-tertiary': '#b996a4',
      '--bg-surface': '#ffffff',
      '--text-primary': '#2d1b24',
      '--border': '#f0dbe4',
    });
  });

  it('renders the empty state when there is no data', () => {
    render(
      <ThemeProvider>
        <BalanceChart chartData={[]} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Nenhum saldo por pessoa')).toBeInTheDocument();
  });

  it('pulls bar colors from the accent and success design tokens', () => {
    renderChart();
    const itens = bars.find((b) => b.dataKey === 'Itens');
    const pagamentos = bars.find((b) => b.dataKey === 'Pagamentos');
    expect(itens.fill).toBe('#d6336c');
    expect(pagamentos.fill).toBe('#1e7a45');
  });

  it('respects a persisted dark theme', async () => {
    localStorage.setItem('theme', 'dark');
    mockTokens({
      '--accent': '#ff79c6',
      '--success-fg': '#50fa7b',
      '--text-secondary': '#a9abc9',
      '--text-tertiary': '#6e7191',
      '--bg-surface': '#282a36',
      '--text-primary': '#f8f8f2',
      '--border': '#44475a',
    });
    renderChart();
    const itens = bars.find((b) => b.dataKey === 'Itens');
    expect(itens.fill).toBe('#ff79c6');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
