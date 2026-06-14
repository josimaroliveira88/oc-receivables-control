import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LayoutDashboard, Users, ClipboardList, DollarSign, LogOut, Sun, Moon } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/people', icon: Users, label: 'Pessoas' },
  { to: '/orders', icon: ClipboardList, label: 'Pedidos' },
  { to: '/receivables', icon: DollarSign, label: 'Recebíveis' },
];

const MobileBottomNav = () => {
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-primary-800 to-primary-600 md:hidden">
      <div className="flex items-center justify-around py-2 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center px-3 py-1 rounded-md transition-colors ${
                isActive ? 'text-white' : 'text-white/60 hover:text-white/80'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs mt-1">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={toggleTheme}
          className="flex flex-col items-center px-3 py-1 text-white/60 hover:text-white/80 transition-colors"
          aria-label={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="text-xs mt-1">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
        </button>
        <button
          onClick={logout}
          className="flex flex-col items-center px-3 py-1 text-white/60 hover:text-white/80 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-xs mt-1">Sair</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
