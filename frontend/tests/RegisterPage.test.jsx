import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegisterPage from '../src/pages/RegisterPage';
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

const renderPage = (initialEntries = ['/register']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockReset();
  });

  describe('Rendering', () => {
    it('should render the page title "Criar Conta"', () => {
      renderPage();
      expect(screen.getByText('Criar Conta')).toBeInTheDocument();
    });

    it('should render "Usuário" input field', () => {
      renderPage();
      expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
    });

    it('should render "Senha" input field', () => {
      renderPage();
      expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    });

    it('should render "Confirmar Senha" input field', () => {
      renderPage();
      expect(screen.getByLabelText('Confirmar Senha')).toBeInTheDocument();
    });

    it('should render "Cadastrar" submit button', () => {
      renderPage();
      expect(screen.getByRole('button', { name: 'Cadastrar' })).toBeInTheDocument();
    });

    it('should render link to login page', () => {
      renderPage();
      expect(screen.getByText('Já tem uma conta?')).toBeInTheDocument();
      expect(screen.getByText('Faça login')).toBeInTheDocument();
    });

    it('should have password type on Senha input', () => {
      renderPage();
      expect(screen.getByLabelText('Senha').type).toBe('password');
    });

    it('should have password type on Confirmar Senha input', () => {
      renderPage();
      expect(screen.getByLabelText('Confirmar Senha').type).toBe('password');
    });
  });

  describe('Validation', () => {
    it('should show error when username is too short', async () => {
      renderPage();
      const usernameInput = screen.getByLabelText('Usuário');
      fireEvent.change(usernameInput, { target: { value: 'ab' } });
      const form = usernameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Usuário deve ter pelo menos 3 caracteres')).toBeInTheDocument();
      });
    });

    it('should show error when password is too short', async () => {
      renderPage();
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: '12345' } });
      const form = usernameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Senha deve ter pelo menos 6 caracteres')).toBeInTheDocument();
      });
    });

    it('should show error when passwords do not match', async () => {
      renderPage();
      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Senha');
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'senha123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'diferente' } });
      const form = usernameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Senhas não conferem')).toBeInTheDocument();
      });
    });

    it('should not call API when validation fails', async () => {
      renderPage();
      const usernameInput = screen.getByLabelText('Usuário');
      fireEvent.change(usernameInput, { target: { value: 'ab' } });
      const form = usernameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).not.toHaveBeenCalled();
      });
    });
  });

  describe('Successful Registration', () => {
    it('should call API with correct data on valid form submission', async () => {
      mockPost.mockResolvedValue({ data: { id: '1', username: 'newuser' } });
      renderPage();

      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Senha');
      fireEvent.change(usernameInput, { target: { value: 'newuser' } });
      fireEvent.change(passwordInput, { target: { value: 'senha123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'senha123' } });

      const form = usernameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/auth/register', {
          username: 'newuser',
          password: 'senha123',
        });
      });
    });

    it('should navigate to /login with success message on successful registration', async () => {
      mockPost.mockResolvedValue({ data: { id: '1', username: 'newuser' } });
      renderPage();

      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Senha');
      fireEvent.change(usernameInput, { target: { value: 'newuser' } });
      fireEvent.change(passwordInput, { target: { value: 'senha123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'senha123' } });

      const form = usernameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login', {
          state: { message: 'Conta criada com sucesso! Faça login.' },
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should show "Usuário já existe" on 409 conflict', async () => {
      mockPost.mockRejectedValue({
        response: { status: 409, data: { error: 'Username already exists' } },
      });
      renderPage();

      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Senha');
      fireEvent.change(usernameInput, { target: { value: 'existinguser' } });
      fireEvent.change(passwordInput, { target: { value: 'senha123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'senha123' } });

      const form = usernameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Usuário já existe')).toBeInTheDocument();
      });
    });

    it('should show generic error message on unknown API error', async () => {
      mockPost.mockRejectedValue(new Error('Network Error'));
      renderPage();

      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Senha');
      fireEvent.change(usernameInput, { target: { value: 'testuser' } });
      fireEvent.change(passwordInput, { target: { value: 'senha123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'senha123' } });

      const form = usernameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Erro ao cadastrar. Tente novamente.')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show "Cadastrando..." and disable button while submitting', async () => {
      let resolvePost;
      mockPost.mockImplementation(() => new Promise((resolve) => { resolvePost = resolve; }));
      renderPage();

      const usernameInput = screen.getByLabelText('Usuário');
      const passwordInput = screen.getByLabelText('Senha');
      const confirmPasswordInput = screen.getByLabelText('Confirmar Senha');
      fireEvent.change(usernameInput, { target: { value: 'newuser' } });
      fireEvent.change(passwordInput, { target: { value: 'senha123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'senha123' } });

      const form = usernameInput.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Cadastrando...')).toBeInTheDocument();
      });

      const btn = screen.getByText('Cadastrando...').closest('button');
      expect(btn).toBeDisabled();

      resolvePost({ data: { id: '1', username: 'newuser' } });
    });
  });

  describe('Navigation', () => {
    it('should have link pointing to /login', () => {
      renderPage();
      const loginLink = screen.getByText('Faça login').closest('a');
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });
});
