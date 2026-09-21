import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FinancesSummary from '../src/pages/Finances/components/FinancesSummary';

const summary = (overrides = {}) => ({
  totalIncome: '180.00',
  totalExpense: '250.00',
  balance: '-70.00',
  pendingTotal: '120.00',
  ...overrides,
});

describe('FinancesSummary pending card', () => {
  it('renders the four summary cards including the pending total', () => {
    render(<FinancesSummary summary={summary()} />);

    expect(screen.getByTestId('finances-summary-income')).toHaveTextContent(
      /180,00/,
    );
    expect(screen.getByTestId('finances-summary-expense')).toHaveTextContent(
      /250,00/,
    );
    expect(screen.getByTestId('finances-summary-balance')).toHaveTextContent(
      /-R\$\s*70,00/,
    );
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByTestId('finances-summary-pending')).toHaveTextContent(
      /120,00/,
    );
  });

  it('dims the pending card when the pending total is zero', () => {
    render(<FinancesSummary summary={summary({ pendingTotal: '0.00' })} />);

    const pending = screen.getByTestId('finances-summary-pending');
    expect(pending).toHaveTextContent(/0,00/);
    expect(pending).toHaveClass('opacity-60');
  });
});
