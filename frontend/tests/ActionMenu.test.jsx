import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ActionMenu from '../src/components/ActionMenu';

const actions = [
  { label: 'Editar', onClick: () => {} },
  { label: 'Excluir', onClick: () => {} },
];

const renderMenu = () =>
  render(
    <ActionMenu
      actions={actions}
      ariaLabel="Ações do pedido"
      testIdPrefix="order-actions-1"
    />,
  );

// jsdom has no layout engine: give all elements a non-zero offsetHeight so the
// component can measure the menu size, then override the trigger individually.
const stubOffsetHeight = (value) =>
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    writable: true,
    configurable: true,
    value,
  });

const stubTriggerNearBottom = (triggerButton) => {
  // The component measures containerRef.current (the wrapping div).
  const container = triggerButton.parentElement;
  container.getBoundingClientRect = () => ({
    top: 760,
    bottom: 788,
    left: 0,
    right: 40,
  });
  Object.defineProperty(container, 'offsetHeight', {
    writable: true,
    configurable: true,
    value: 28,
  });
};

describe('ActionMenu', () => {
  afterEach(() => {
    delete HTMLElement.prototype.offsetHeight;
    delete window.innerHeight;
  });

  it('renders the trigger and keeps the menu hidden by default', () => {
    renderMenu();
    expect(screen.getByTestId('order-actions-1-trigger')).toBeInTheDocument();
    expect(
      screen.queryByTestId('order-actions-1-menu'),
    ).not.toBeInTheDocument();
  });

  it('opens downward by default when there is room below', async () => {
    stubOffsetHeight(96);
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    });
    renderMenu();
    fireEvent.click(screen.getByTestId('order-actions-1-trigger'));
    await waitFor(() => {
      expect(screen.getByTestId('order-actions-1-menu')).toBeInTheDocument();
    });
    const menu = screen.getByTestId('order-actions-1-menu');
    expect(menu.className).not.toContain('bottom-full');
    expect(menu.className).not.toContain('mb-2');
  });

  it('opens upward when the trigger is near the bottom of the viewport', async () => {
    stubOffsetHeight(96);
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    });
    renderMenu();
    const trigger = screen.getByTestId('order-actions-1-trigger');
    stubTriggerNearBottom(trigger);

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('order-actions-1-menu').className).toContain(
        'bottom-full',
      );
    });
    expect(screen.getByTestId('order-actions-1-menu').className).toContain(
      'mb-2',
    );
  });

  it('still closes via backdrop after opening upward', async () => {
    stubOffsetHeight(96);
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    });
    renderMenu();
    const trigger = screen.getByTestId('order-actions-1-trigger');
    stubTriggerNearBottom(trigger);
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('order-actions-1-menu').className).toContain(
        'bottom-full',
      );
    });

    fireEvent.click(screen.getByTestId('order-actions-1-backdrop'));
    await waitFor(() => {
      expect(
        screen.queryByTestId('order-actions-1-menu'),
      ).not.toBeInTheDocument();
    });
  });
});
