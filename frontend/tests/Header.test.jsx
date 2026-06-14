import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Header from '../src/components/Header';

const { mockLogout, mockUserRef } = vi.hoisted(() => {
  const logoutFn = vi.fn();
  const userRef = { value: null };
  return { mockLogout: logoutFn, mockUserRef: userRef };
});

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ logout: mockLogout, user: mockUserRef.value }),
}));
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

const renderHeader = (initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Header />
    </MemoryRouter>
  );
};

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRef.value = null;
  });

  it('should render the app title', () => {
    renderHeader();
    expect(screen.getByText('Controle de Recebíveis')).toBeInTheDocument();
  });

  it('should render desktop navigation links', () => {
    renderHeader();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Pessoas')).toBeInTheDocument();
    expect(screen.getByText('Pedidos')).toBeInTheDocument();
    expect(screen.getByText('Recebíveis')).toBeInTheDocument();
  });

  it('should render Sair button', () => {
    renderHeader();
    expect(screen.getByText('Sair')).toBeInTheDocument();
  });

  it('should call logout when Sair is clicked', () => {
    renderHeader();
    fireEvent.click(screen.getByText('Sair'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('should display the logged-in username', () => {
    mockUserRef.value = { id: 1, username: 'joao' };
    renderHeader();
    expect(screen.getByText('joao')).toBeInTheDocument();
  });

  it('should not display username when user is not logged in', () => {
    renderHeader();
    expect(screen.queryByText('joao')).not.toBeInTheDocument();
  });
});
