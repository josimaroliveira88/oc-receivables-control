import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DoterraImportModal from '../src/pages/Orders/components/DoterraImportModal';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
  },
}));

const renderModal = (props = {}) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <DoterraImportModal
          isOpen
          form={{ json: '' }}
          error=""
          submitting={false}
          summary={null}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
          onClose={vi.fn()}
          {...props}
        />
      </ToastProvider>
    </MemoryRouter>,
  );

describe('DoterraImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: [] });
  });

  it('renders the capture instructions and the extension download', () => {
    renderModal();

    expect(screen.getByText('Importar pedidos dōTERRA')).toBeInTheDocument();
    expect(
      screen.getByText(/Rastreamento de Pedidos e Pacotes/),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('doterra-import-extension-download'),
    ).toHaveAttribute('href', '/captures-extension.zip');
  });

  it('checks both token scopes by default', () => {
    renderModal();

    expect(screen.getByTestId('doterra-token-scope-uber:import')).toBeChecked();
    expect(
      screen.getByTestId('doterra-token-scope-doterra:import'),
    ).toBeChecked();
  });

  it('submits the pasted JSON through the form handler', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    renderModal({ onChange, onSubmit });

    fireEvent.change(screen.getByTestId('doterra-import-json'), {
      target: { value: '{"orders":[]}' },
    });
    expect(onChange).toHaveBeenCalledWith('json', '{"orders":[]}');

    fireEvent.click(screen.getByTestId('doterra-import-submit'));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('renders the import summary with created, failed and created products', () => {
    renderModal({
      summary: {
        created: [
          {
            orderNumber: '184145362',
            id: 'o1',
            warnings: ['Produto X inativo'],
          },
        ],
        existing: ['185245937'],
        failed: [{ orderNumber: '182330277', error: 'Itens inválidos' }],
        createdProducts: [{ code: '60233778', name: 'Kit' }],
      },
    });

    expect(screen.getByTestId('doterra-import-summary')).toBeInTheDocument();
    expect(screen.getByTestId('doterra-import-created')).toHaveTextContent('1');
    expect(screen.getByTestId('doterra-import-existing')).toHaveTextContent(
      '1',
    );
    expect(screen.getByTestId('doterra-import-failed')).toHaveTextContent('1');
    expect(screen.getByText(/Produto X inativo/)).toBeInTheDocument();
    expect(screen.getByText(/182330277/)).toBeInTheDocument();
    expect(screen.getByText(/60233778/)).toBeInTheDocument();
  });

  it('shows the error message when the import fails', () => {
    renderModal({ error: 'JSON inválido.' });
    expect(screen.getByText('JSON inválido.')).toBeInTheDocument();
  });
});
