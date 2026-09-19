import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import App from '../src/App';

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    loading: false,
    user: { id: 1, username: 'joao' },
    logout: vi.fn(),
  }),
}));

vi.mock('../src/components/Header', () => ({ default: () => null }));
vi.mock('../src/components/MobileDrawer', () => ({ default: () => null }));
vi.mock('../src/components/OnboardingTour', () => ({ default: () => null }));

vi.mock('../src/pages/PeoplePage', () => ({
  default: () => <div data-testid="people-page" />,
}));
vi.mock('../src/pages/OrdersPage', () => ({
  default: () => <div data-testid="orders-page" />,
}));
vi.mock('../src/pages/SalesPage', () => ({
  default: () => <div data-testid="sales-page" />,
}));
vi.mock('../src/pages/ProductsPage', () => ({
  default: () => <div data-testid="products-page" />,
}));
vi.mock('../src/pages/StockPage', () => ({
  default: () => <div data-testid="stock-page" />,
}));
vi.mock('../src/pages/FinancesPage', () => ({
  default: () => <div data-testid="finances-page" />,
}));
vi.mock('../src/pages/LoginPage', () => ({
  default: () => <div data-testid="login-page" />,
}));
vi.mock('../src/pages/RegisterPage', () => ({
  default: () => <div data-testid="register-page" />,
}));

const renderApp = (initialEntries = ['/']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );

describe('App routing', () => {
  it('lands on the finances screen when the root path is opened', () => {
    renderApp(['/']);
    expect(screen.getByTestId('finances-page')).toBeInTheDocument();
    expect(screen.queryByTestId('products-page')).not.toBeInTheDocument();
  });

  it('redirects unknown paths to the finances screen', () => {
    renderApp(['/does-not-exist']);
    expect(screen.getByTestId('finances-page')).toBeInTheDocument();
  });
});
