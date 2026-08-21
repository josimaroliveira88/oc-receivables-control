import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SortableHeader from '../src/components/SortableHeader';
import SearchInput from '../src/components/SearchInput';

describe('SortableHeader', () => {
  it('renders the label and a neutral sort icon when not active', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableHeader
              label="Nome"
              field="name"
              sortBy="whatsapp"
              sortDir="asc"
              onSort={vi.fn()}
            />
          </tr>
        </thead>
      </table>,
    );

    expect(screen.getByText('Nome')).toBeInTheDocument();
    expect(screen.getByRole('columnheader')).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('sorts ascending on first click when inactive', () => {
    const onSort = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortableHeader
              label="Nome"
              field="name"
              sortBy="whatsapp"
              sortDir="asc"
              onSort={onSort}
            />
          </tr>
        </thead>
      </table>,
    );

    fireEvent.click(screen.getByText('Nome'));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('toggles to descending when the active column is ascending', () => {
    const onSort = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortableHeader
              label="Nome"
              field="name"
              sortBy="name"
              sortDir="asc"
              onSort={onSort}
            />
          </tr>
        </thead>
      </table>,
    );

    expect(screen.getByRole('columnheader')).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    fireEvent.click(screen.getByText('Nome'));
    expect(onSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('toggles back to ascending when the active column is descending', () => {
    const onSort = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortableHeader
              label="Nome"
              field="name"
              sortBy="name"
              sortDir="desc"
              onSort={onSort}
            />
          </tr>
        </thead>
      </table>,
    );

    expect(screen.getByRole('columnheader')).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    fireEvent.click(screen.getByText('Nome'));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('applies right alignment class for numeric columns', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableHeader
              label="Valor"
              field="totalValue"
              sortBy=""
              sortDir="asc"
              onSort={vi.fn()}
              align="right"
            />
          </tr>
        </thead>
      </table>,
    );

    expect(screen.getByRole('columnheader').className).toContain('text-right');
  });
});

describe('SearchInput', () => {
  it('renders placeholder and aria-label', () => {
    render(
      <SearchInput
        value=""
        onChange={vi.fn()}
        placeholder="Buscar clientes..."
        ariaLabel="Buscar clientes"
      />,
    );

    expect(
      screen.getByPlaceholderText('Buscar clientes...'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'aria-label',
      'Buscar clientes',
    );
  });

  it('calls onChange with the new value', () => {
    const onChange = vi.fn();
    render(
      <SearchInput
        value=""
        onChange={onChange}
        placeholder="Buscar..."
        ariaLabel="Buscar"
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'João' },
    });
    expect(onChange).toHaveBeenCalledWith('João');
  });
});
