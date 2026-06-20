import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LayoutDashboard, Users, ClipboardList, DollarSign, LogOut, Sun, Moon, User, HelpCircle } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/people', icon: Users, label: 'Pessoas' },
  { to: '/orders', icon: ClipboardList, label: 'Pedidos' },
  { to: '/receivables', icon: DollarSign, label: 'Recebíveis' },
];

const userMenuItems = [
  { icon: HelpCircle, label: 'Tutorial' },
  { icon: LogOut, label: 'Sair' },
];

const MobileBottomNav = () => {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleMenuItemClick = (label) => {
    setShowDropdown(false);
    if (label === 'Sair') logout();
    if (label === 'Tutorial') window.dispatchEvent(new Event('start-onboarding-tour'));
  };

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
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown((prev) => !prev)}
              className={`flex flex-col items-center px-2 py-1 rounded-md transition-colors ${
                showDropdown ? 'text-white bg-white/20' : 'text-white/60 hover:text-white/80'
              }`}
              aria-label="Menu do usuário"
            >
              <User className="w-5 h-5" />
              <span className="text-xs mt-1 truncate max-w-[72px] overflow-hidden">{user.username}</span>
            </button>
            {showDropdown && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 min-w-[120px] border border-gray-200 dark:border-gray-700">
                {userMenuItems.map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    onClick={() => handleMenuItemClick(label)}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
