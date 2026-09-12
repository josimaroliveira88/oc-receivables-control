import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LogOut, Sun, Moon, User, HelpCircle } from 'lucide-react';
import { navigationItems } from '../utils/navigation';

const Header = () => {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  return (
    <header className="hidden md:block bg-surface border-b border-line shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Controle de Recebíveis</h1>
        <div className="flex items-center space-x-3">
          <nav className="hidden md:flex items-center space-x-2 mr-4">
            {navigationItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-medium rounded-md transition-colors inline-flex items-center ${
                    isActive
                      ? 'text-accent-on-soft bg-accent-soft'
                      : 'text-ink-soft hover:text-accent-on-soft hover:bg-accent-soft'
                  }`
                }
              >
                <Icon className="w-4 h-4 mr-1" />
                {label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={() =>
              window.dispatchEvent(new Event('start-onboarding-tour'))
            }
            className="hidden md:inline-flex items-center p-2 text-ink-soft hover:text-accent-on-soft hover:bg-accent-soft rounded-md transition-colors"
            aria-label="Tutorial"
            title="Tutorial"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={toggleTheme}
            className="hidden md:inline-flex items-center p-2 text-ink-soft hover:text-accent-on-soft hover:bg-accent-soft rounded-md transition-colors"
            aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
          {user && (
            <span className="hidden md:inline-flex items-center px-3 py-1.5 text-sm text-ink-soft bg-base rounded-md">
              <User className="w-4 h-4 mr-1.5" />
              {user.username}
            </span>
          )}
          <button
            onClick={logout}
            className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-ink-soft hover:text-accent-on-soft hover:bg-accent-soft rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4 mr-1" />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
