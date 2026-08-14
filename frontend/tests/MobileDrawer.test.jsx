import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MobileDrawer from '../src/components/MobileDrawer';

const { mockLogout, mockToggleTheme, mockUserRef } = vi.hoisted(() => {
  const logoutFn = vi.fn();
  const toggleThemeFn = vi.fn();
  const userRef = { value: null };
  return {
    mockLogout: logoutFn,
    mockToggleTheme: toggleThemeFn,
    mockUserRef: userRef,
  };
});

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ logout: mockLogout, user: mockUserRef.value }),
}));
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: mockToggleTheme }),
}));

const renderDrawer = (initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MobileDrawer />
    </MemoryRouter>,
  );
};

describe('MobileDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRef.value = null;
  });

  it('should render the app title and hamburger button', () => {
    renderDrawer();
    expect(screen.getByText('Controle de Recebíveis')).toBeInTheDocument();
    expect(screen.getByLabelText('Abrir menu')).toBeInTheDocument();
  });

  it('should be closed by default', () => {
    renderDrawer();
    const drawer = screen.getByRole('complementary');
    expect(drawer.className).toContain('-translate-x-full');
  });

  it('should open the drawer when the hamburger is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByLabelText('Abrir menu'));
    expect(screen.getByRole('complementary').className).toContain(
      'translate-x-0',
    );
  });

  it('should render all 5 navigation items in the drawer', () => {
    renderDrawer();
    fireEvent.click(screen.getByLabelText('Abrir menu'));
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Pedidos')).toBeInTheDocument();
    expect(screen.getByText('Recebíveis')).toBeInTheDocument();
    expect(screen.getByText('Produtos')).toBeInTheDocument();
  });

  it('should have 5 links in the drawer', () => {
    renderDrawer();
    fireEvent.click(screen.getByLabelText('Abrir menu'));
    expect(screen.getAllByRole('link')).toHaveLength(5);
  });

  it('should close the drawer when a nav link is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByLabelText('Abrir menu'));
    fireEvent.click(screen.getByText('Clientes'));
    expect(screen.getByRole('complementary').className).toContain(
      '-translate-x-full',
    );
  });

  it('should highlight the active link', () => {
    renderDrawer(['/people']);
    fireEvent.click(screen.getByLabelText('Abrir menu'));
    const peopleLink = screen
      .getAllByRole('link')
      .find((link) => link.getAttribute('href') === '/people');
    expect(peopleLink.className).toContain('text-primary-600');
  });

  it('should call logout when Sair is clicked', () => {
    mockUserRef.value = { id: 1, username: 'joao' };
    renderDrawer();
    fireEvent.click(screen.getByLabelText('Abrir menu'));
    fireEvent.click(screen.getByText('Sair'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('should dispatch tutorial event when Tutorial is clicked', () => {
    const dispatchSpy = vi.fn();
    const originalDispatch = window.dispatchEvent;
    window.dispatchEvent = dispatchSpy;
    renderDrawer();
    fireEvent.click(screen.getByLabelText('Abrir menu'));
    fireEvent.click(screen.getByText('Tutorial'));
    expect(dispatchSpy).toHaveBeenCalled();
    window.dispatchEvent = originalDispatch;
  });

  it('should close the drawer when the backdrop is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByLabelText('Abrir menu'));
    fireEvent.click(screen.getByTestId('drawer-overlay'));
    expect(screen.getByRole('complementary').className).toContain(
      '-translate-x-full',
    );
  });

  it('should be hidden on desktop with md:hidden class', () => {
    renderDrawer();
    expect(screen.getByRole('complementary').className).toContain('md:hidden');
  });
});
