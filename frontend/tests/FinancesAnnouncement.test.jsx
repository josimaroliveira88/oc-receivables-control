import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FinancesAnnouncement from '../src/components/FinancesAnnouncement';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('../src/context/AuthContext', () => ({ useAuth: mockUseAuth }));

const TITLE = 'Novo módulo de Finanças';

describe('FinancesAnnouncement', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'joao' } });
  });

  it('shows the announcement when the user has not seen it yet', () => {
    render(<FinancesAnnouncement />);
    expect(screen.getByText(TITLE)).toBeInTheDocument();
  });

  it('does not show when the current user has already seen it', () => {
    localStorage.setItem('finances_announcement_seen_1', 'true');
    render(<FinancesAnnouncement />);
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it('lists the finances module highlights', () => {
    render(<FinancesAnnouncement />);
    expect(
      screen.getByText('Lançamentos de receitas e despesas'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Resumo de receitas, despesas e saldo'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Filtros por período, tipo, origem e categoria'),
    ).toBeInTheDocument();
    expect(screen.getByText('Categorias personalizáveis')).toBeInTheDocument();
    expect(screen.getByText('Baixa de vendas por gateway')).toBeInTheDocument();
  });

  it('marks it as seen for the current user when dismissed', () => {
    render(<FinancesAnnouncement />);
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));

    expect(localStorage.getItem('finances_announcement_seen_1')).toBe('true');
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it('marks it as seen when closed through the shared modal', () => {
    render(<FinancesAnnouncement />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(localStorage.getItem('finances_announcement_seen_1')).toBe('true');
  });

  it('stays hidden after being dismissed and remounted', () => {
    const { unmount } = render(<FinancesAnnouncement />);
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    unmount();

    render(<FinancesAnnouncement />);
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it('tracks the seen state per user', () => {
    localStorage.setItem('finances_announcement_seen_1', 'true');
    mockUseAuth.mockReturnValue({ user: { id: 2, username: 'maria' } });

    render(<FinancesAnnouncement />);
    expect(screen.getByText(TITLE)).toBeInTheDocument();
  });

  it('does not show when there is no authenticated user', () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<FinancesAnnouncement />);
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });
});
