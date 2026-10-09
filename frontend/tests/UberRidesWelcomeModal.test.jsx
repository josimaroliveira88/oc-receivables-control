import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UberRidesWelcomeModal from '../src/pages/UberRides/components/UberRidesWelcomeModal';
import { ToastProvider } from '../src/components/Toast';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('../src/services/api', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

const renderModal = (props = {}) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <UberRidesWelcomeModal
          isOpen
          onClose={vi.fn()}
          onOpenImport={vi.fn()}
          onOpenGuide={vi.fn()}
          userName="joao"
          {...props}
        />
      </ToastProvider>
    </MemoryRouter>,
  );

describe('UberRidesWelcomeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGet.mockResolvedValue({ data: [] });
  });

  it('renders the orientation title and the load-unpacked steps', async () => {
    renderModal();

    expect(
      screen.getByText('Como capturar as corridas do Uber?'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Conectado como joao/)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Carregar sem compactação/).length,
    ).toBeGreaterThan(0);
  });

  it('generates a token and shows the cleartext exactly once with an expiry hint', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: 'tok-1',
        name: 'Extensão Corridas Uber',
        scope: 'uber:import',
        lastFour: 'ABCD',
        expiresAt: '2027-01-01T00:00:00.000Z',
        revokedAt: null,
        token: 'cr_secret-token-ABCD',
      },
    });
    renderModal();

    fireEvent.click(screen.getByTestId('uber-token-generate'));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api-tokens', {
        name: 'Extensão Corridas Uber',
        scopes: ['uber:import', 'doterra:import'],
        ttlDays: 30,
      }),
    );

    expect(await screen.findByTestId('uber-token-value')).toHaveTextContent(
      'cr_secret-token-ABCD',
    );
    expect(screen.getByTestId('uber-token-copy')).toBeInTheDocument();
    expect(screen.getByText(/só aparece agora/)).toBeInTheDocument();
  });

  it('checks both capture scopes by default', async () => {
    renderModal();

    expect(screen.getByTestId('uber-token-scope-uber:import')).toBeChecked();
    expect(screen.getByTestId('uber-token-scope-doterra:import')).toBeChecked();
  });

  it('persists the "não mostrar de novo" flag and closes', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByTestId('uber-rides-welcome-dismiss'));
    fireEvent.click(screen.getByTestId('uber-rides-welcome-close'));

    expect(localStorage.getItem('uber-rides-welcome-dismissed')).toBe('true');
    expect(onClose).toHaveBeenCalled();
  });

  it('opens the import modal after closing', async () => {
    const onOpenImport = vi.fn();
    renderModal({ onOpenImport });

    fireEvent.click(screen.getByTestId('uber-rides-welcome-open-import'));

    expect(onOpenImport).toHaveBeenCalled();
  });

  it('links to the detailed guide', async () => {
    const onOpenGuide = vi.fn();
    renderModal({ onOpenGuide });

    fireEvent.click(screen.getByTestId('uber-rides-welcome-guide-link'));

    expect(onOpenGuide).toHaveBeenCalled();
  });

  it('offers the extension ZIP download', () => {
    renderModal();

    const download = screen.getByTestId('captures-extension-download');
    expect(download).toHaveAttribute('href', '/captures-extension.zip');
    expect(download).toHaveAttribute('download');
  });
});
