import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, UserPlus, CheckSquare, Users, ClipboardList,
  BarChart3, LogOut, Bot, Shield, MapPin,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const NavItem = ({ to, icon: Icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
        isActive
          ? 'bg-primary-600 text-white shadow-sm'
          : 'text-gray-300 hover:bg-white/10 hover:text-white'
      }`
    }
  >
    <Icon size={18} />
    {label}
  </NavLink>
);

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const employeeNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/visits/new', icon: UserPlus, label: 'New Visit' },
    { to: '/visits/approvals', icon: CheckSquare, label: 'Approvals' },
  ];

  const adminNav = [
    { to: '/admin', icon: BarChart3, label: 'Overview' },
    { to: '/admin/employees', icon: Users, label: 'Employees' },
    { to: '/admin/logs', icon: ClipboardList, label: 'Visit Logs' },
    { to: '/admin/temi', icon: Bot, label: 'Temi Robot' },
    { to: '/dashboard', icon: LayoutDashboard, label: 'My Visits' },
    { to: '/visits/new', icon: UserPlus, label: 'New Visit' },
    { to: '/visits/approvals', icon: CheckSquare, label: 'Approvals' },
  ];

  const navItems = user?.role === 'admin' ? adminNav : employeeNav;

  return (
    <div className="w-64 min-h-screen bg-dark flex flex-col shadow-xl">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Temi VMS</div>
            <div className="text-gray-400 text-xs">Visitor Management</div>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium truncate">{user?.name}</div>
            <div className="text-gray-400 text-xs flex items-center gap-1">
              <Shield size={10} />
              <span className="capitalize">{user?.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-red-500/20 hover:text-red-300 transition-all duration-150"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}
