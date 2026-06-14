import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MobileBottomNav from '../src/components/MobileBottomNav';

const mockLogout = vi.fn();
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ logout: (...args) => mockLogout(...args) }),
}));
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

const renderBottomNav = (initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MobileBottomNav />
    </MemoryRouter>
  );
};

describe('MobileBottomNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all navigation items', () => {
    renderBottomNav();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Pessoas')).toBeInTheDocument();
    expect(screen.getByText('Pedidos')).toBeInTheDocument();
    expect(screen.getByText('Recebíveis')).toBeInTheDocument();
    expect(screen.getByText('Sair')).toBeInTheDocument();
  });

  it('should have 4 links and 1 button', () => {
    renderBottomNav();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('should call logout when Sair is clicked', () => {
    renderBottomNav();
    fireEvent.click(screen.getByText('Sair'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('should highlight the active link', () => {
    renderBottomNav(['/people']);
    const links = screen.getAllByRole('link');
    const peopleLink = links.find(link => link.getAttribute('href') === '/people');
    expect(peopleLink.className).toContain('text-white');
    expect(peopleLink.className).not.toContain('text-white/60');
  });

  it('should hide on desktop with md:hidden class', () => {
    renderBottomNav();
    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('md:hidden');
  });

  it('should be fixed at the bottom', () => {
    renderBottomNav();
    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('fixed');
    expect(nav.className).toContain('bottom-0');
  });
});
