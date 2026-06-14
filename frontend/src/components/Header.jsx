import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, ClipboardList, DollarSign, LogOut } from 'lucide-react';

const navLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/people', icon: Users, label: 'Pessoas' },
  { to: '/orders', icon: ClipboardList, label: 'Pedidos' },
  { to: '/receivables', icon: DollarSign, label: 'Recebíveis' },
];

const Header = () => {
  const { logout } = useAuth();
  return (
    <header className="bg-gradient-to-r from-blue-800 to-blue-600 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">
          Controle de Recebíveis
        </h1>
        <div className="flex items-center space-x-3">
          <nav className="hidden md:flex items-center space-x-2 mr-4">
            {navLinks.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-2 text-sm font-medium rounded-md transition-colors inline-flex items-center ${
                    isActive
                      ? 'text-white bg-white/20'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <Icon className="w-4 h-4 mr-1" />
                {label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={logout}
            className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors"
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
