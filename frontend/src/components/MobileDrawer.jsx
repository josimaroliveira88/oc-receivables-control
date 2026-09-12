import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  ShoppingCart,
  Package,
  Boxes,
  LogOut,
  Sun,
  Moon,
  User,
  HelpCircle,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/people', icon: Users, label: 'Clientes' },
  { to: '/orders', icon: ClipboardList, label: 'Pedidos dōTERRA' },
  { to: '/sales', icon: ShoppingCart, label: 'Vendas' },
  { to: '/products', icon: Package, label: 'Produtos' },
  { to: '/stock', icon: Boxes, label: 'Estoque' },
];

const MobileDrawer = () => {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const closeDrawer = () => setIsOpen(false);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-40 bg-surface border-b border-line shadow-sm md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 text-ink-soft hover:text-accent-on-soft hover:bg-accent-soft rounded-md transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-ink">Controle de Recebíveis</h1>
          <div className="flex items-center space-x-1">
            <button
              onClick={toggleTheme}
              className="p-2 text-ink-soft hover:text-accent-on-soft hover:bg-accent-soft rounded-md transition-colors"
              aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            {user && (
              <span
                className="p-1.5 text-ink-soft bg-base rounded-md"
                aria-label="Usuário logado"
              >
                <User className="w-5 h-5" />
              </span>
            )}
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          data-testid="drawer-overlay"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      <aside
        ref={drawerRef}
        aria-label="Menu de navegação"
        className={`fixed top-0 left-0 h-full w-64 z-50 bg-surface shadow-xl transform transition-transform md:hidden flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 className="text-lg font-bold text-ink">Menu</h2>
          <button
            onClick={closeDrawer}
            className="p-1.5 text-ink-faint hover:text-ink transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="py-2 flex-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeDrawer}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-accent-on-soft bg-accent-soft'
                    : 'text-ink-soft hover:text-accent-on-soft hover:bg-accent-soft'
                }`
              }
            >
              <Icon className="w-5 h-5 mr-3" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line py-2">
          <button
            onClick={() => {
              closeDrawer();
              window.dispatchEvent(new Event('start-onboarding-tour'));
            }}
            className="w-full flex items-center px-4 py-3 text-sm text-ink-soft hover:bg-accent-soft transition-colors"
          >
            <HelpCircle className="w-5 h-5 mr-3" />
            Tutorial
          </button>
          {user && (
            <button
              onClick={() => {
                closeDrawer();
                logout();
              }}
              className="w-full flex items-center px-4 py-3 text-sm text-danger-fg hover:bg-accent-soft transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sair
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default MobileDrawer;
