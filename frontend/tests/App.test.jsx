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

vi.mock('../src/pages/DashboardPage', () => ({
  default: () => <div data-testid="dashboard-page" />,
}));
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
  it('lands on the products screen when the root path is opened', () => {
    renderApp(['/']);
    expect(screen.getByTestId('products-page')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
  });

  it('renders the dashboard at /dashboard', () => {
    renderApp(['/dashboard']);
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });

  it('redirects unknown paths to the products screen', () => {
    renderApp(['/does-not-exist']);
    expect(screen.getByTestId('products-page')).toBeInTheDocument();
  });
});
