import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Modal from '../src/components/Modal';

const renderModal = (props = {}) =>
  render(
    <Modal
      isOpen
      title="Teste"
      onClose={props.onClose || (() => {})}
      {...props}
    >
      <div>Conteúdo do modal</div>
    </Modal>,
  );

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal isOpen={false} title="Teste" onClose={() => {}} />);
    expect(screen.queryByText('Teste')).not.toBeInTheDocument();
  });

  it('renders the title and children when open', () => {
    renderModal();
    expect(screen.getByText('Teste')).toBeInTheDocument();
    expect(screen.getByText('Conteúdo do modal')).toBeInTheDocument();
  });

  it('closes directly on backdrop click when not dirty', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the card', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.mouseDown(screen.getByText('Conteúdo do modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes directly on Escape when not dirty', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes directly on the close button when not dirty', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a discard confirmation instead of closing when dirty on backdrop click', () => {
    const onClose = vi.fn();
    renderModal({ onClose, isDirty: true });
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Descartar alterações?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a discard confirmation instead of closing when dirty on Escape', () => {
    const onClose = vi.fn();
    renderModal({ onClose, isDirty: true });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a discard confirmation when dirty on the close button', () => {
    const onClose = vi.fn();
    renderModal({ onClose, isDirty: true });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes after confirming the discard', () => {
    const onClose = vi.fn();
    renderModal({ onClose, isDirty: true });
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the modal open when cancelling the discard', () => {
    const onClose = vi.fn();
    renderModal({ onClose, isDirty: true });
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));

    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Conteúdo do modal')).toBeInTheDocument();
  });

  it('ignores backdrop click while submitting', () => {
    const onClose = vi.fn();
    renderModal({ onClose, isDirty: true, submitting: true });
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('provides requestClose to children through the render prop', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen title="Teste" onClose={onClose} isDirty={false}>
        {(requestClose) => (
          <button type="button" onClick={requestClose}>
            Cancelar custom
          </button>
        )}
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar custom' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('routes the render-prop requestClose through the dirty check', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen title="Teste" onClose={onClose} isDirty>
        {(requestClose) => (
          <button type="button" onClick={requestClose}>
            Cancelar custom
          </button>
        )}
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar custom' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('exposes a backdrop with the shared modal z-index class', () => {
    renderModal();
    const backdrop = screen.getByTestId('modal-backdrop');
    expect(backdrop.className).toContain('fixed');
    expect(backdrop.className).toContain('inset-0');
    expect(backdrop.className).toContain('z-[60]');
  });

  it('clears the discard dialog and unmounts when closed', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen title="Teste" onClose={onClose} isDirty>
        <div>Conteúdo</div>
      </Modal>,
    );
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(<Modal isOpen={false} title="Teste" onClose={onClose} isDirty />);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Teste')).not.toBeInTheDocument();
  });
});
