import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';

const TestComponent = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button data-testid="toggle-btn" onClick={toggleTheme}>
        Toggle
      </button>
    </div>
  );
};

const renderWithProvider = () => {
  return render(
    <ThemeProvider>
      <TestComponent />
    </ThemeProvider>
  );
};

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('should default to light theme when no preference is saved', () => {
    renderWithProvider();
    expect(screen.getByTestId('theme-value').textContent).toBe('light');
  });

  it('should toggle theme from light to dark', () => {
    renderWithProvider();
    expect(screen.getByTestId('theme-value').textContent).toBe('light');

    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(screen.getByTestId('theme-value').textContent).toBe('dark');
  });

  it('should toggle theme from dark to light', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(screen.getByTestId('theme-value').textContent).toBe('dark');

    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(screen.getByTestId('theme-value').textContent).toBe('light');
  });

  it('should add dark class to documentElement when theme is dark', () => {
    renderWithProvider();
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should remove dark class from documentElement when theme is light', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should persist theme preference in localStorage', () => {
    renderWithProvider();
    expect(localStorage.getItem('theme')).toBe('light');

    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(localStorage.getItem('theme')).toBe('dark');

    fireEvent.click(screen.getByTestId('toggle-btn'));
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('should throw error when useTheme is used outside ThemeProvider', () => {
    const renderOutside = () => render(<TestComponent />);
    expect(renderOutside).toThrow('useTheme must be used within a ThemeProvider');
  });
});
