import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '../src/pages/LoginPage';
import { AuthProvider } from '../src/context/AuthContext';

const mockPost = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    post: (...args) => mockPost(...args),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderPage = (initialEntries = ['/login'], routeState = undefined) => {
  const entry = routeState
    ? { pathname: '/login', state: routeState }
    : '/login';
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockReset();
  });

  describe('Rendering', () => {
    it('should render "Entrar no Sistema" subtitle', () => {
      renderPage();
      expect(screen.getByText('Entrar no Sistema')).toBeInTheDocument();
    });

    it('should render "Usuário" input field', () => {
      renderPage();
      expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
    });

    it('should render "Senha" input field', () => {
      renderPage();
      expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    });

    it('should render "Acessar" button', () => {
      renderPage();
      expect(screen.getByRole('button', { name: 'Acessar' })).toBeInTheDocument();
    });
  });

  describe('Registration Link', () => {
    it('should render "Criar uma conta" link', () => {
      renderPage();
      expect(screen.getByText('Criar uma conta')).toBeInTheDocument();
    });

    it('should link to /register', () => {
      renderPage();
      const registerLink = screen.getByText('Criar uma conta').closest('a');
      expect(registerLink).toHaveAttribute('href', '/register');
    });
  });

  describe('Registration Success Message', () => {
    it('should display success message when arriving from registration', () => {
      renderPage(undefined, { message: 'Conta criada com sucesso! Faça login.' });
      expect(screen.getByText('Conta criada com sucesso! Faça login.')).toBeInTheDocument();
    });

    it('should not display success message on normal login visit', () => {
      renderPage();
      expect(screen.queryByText('Conta criada com sucesso! Faça login.')).not.toBeInTheDocument();
    });
  });

  describe('Login Form', () => {
    it('should show error message on failed login', async () => {
      mockPost.mockRejectedValue(new Error('Invalid credentials'));
      renderPage();

      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      fireEvent.change(usernameInput, { target: { value: 'admin' } });
      fireEvent.change(passwordInput, { target: { value: 'wrong' } });

      const form = usernameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Usuário ou senha inválidos. Tente novamente.')).toBeInTheDocument();
      });
    });
  });
});
