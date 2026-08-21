import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ToastProvider, useToast } from '../src/components/Toast';

const ToastTrigger = ({ message, type }) => {
  const { addToast } = useToast();
  return (
    <button onClick={() => addToast(message, type)}>Disparar toast</button>
  );
};

describe('Toast', () => {
  it('renderiza toast de erro ao disparar via contexto', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Erro de teste" type="error" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Disparar toast'));

    expect(screen.getByText('Erro de teste')).toBeInTheDocument();
  });

  it('renderiza toast de sucesso ao disparar via contexto', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Sucesso de teste" type="success" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Disparar toast'));

    expect(screen.getByText('Sucesso de teste')).toBeInTheDocument();
  });

  it('posiciona o container de toasts acima de todas as camadas (z-[90])', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Erro de modal" type="error" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Disparar toast'));

    const container = screen
      .getByText('Erro de modal')
      .closest('.fixed.top-4.right-4');

    expect(container).not.toBeNull();
    expect(container.className).toContain('z-[90]');
  });

  it('mantém o toast visível (sem backdrop escurecido próprio) acima da modal', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Erro de modal" type="error" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText('Disparar toast'));

    const toast = screen.getByText('Erro de modal').closest('div');
    expect(toast).not.toBeNull();
    expect(toast.className).not.toContain('backdrop-blur');
  });
});
