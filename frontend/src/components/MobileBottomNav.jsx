import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, ClipboardList, DollarSign, LogOut } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/people', icon: Users, label: 'Pessoas' },
  { to: '/orders', icon: ClipboardList, label: 'Pedidos' },
  { to: '/receivables', icon: DollarSign, label: 'Recebíveis' },
];

const MobileBottomNav = () => {
  const { logout } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-800 to-blue-600 md:hidden">
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
