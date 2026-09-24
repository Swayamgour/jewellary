import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Coins,
  Bell,
  User,
  LogOut,
  Building,
  Menu,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import {
  selectCurrentUser,
  selectUserRole,
  selectCurrentBranch,
  logout
} from '../../features/auth/authSlice';
import { useGetCurrentGoldRatesQuery, useGetDashboardQuery } from '../../app/api/baseApi';
import { formatCurrency } from '../../utils/formatters';

export const Navbar = ({ onOpenSidebar, onOpenSearch, onOpenGoldRates }) => {
  const user = useSelector(selectCurrentUser);
  const role = useSelector(selectUserRole);
  const branch = useSelector(selectCurrentBranch);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const { data: goldRatesData } = useGetCurrentGoldRatesQuery();
  const { data: dashData } = useGetDashboardQuery({ filter: 'today' });

  const goldRates = goldRatesData?.data || [];
  const rate24K = goldRates.find((r) => r.metal === 'GOLD' && r.purity === '24K')?.rate || 7850;
  const rate22K = goldRates.find((r) => r.metal === 'GOLD' && r.purity === '22K')?.rate || 7195;
  const rateSilver = goldRates.find((r) => r.metal === 'SILVER')?.rate || 96;

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const pendingOrders = dashData?.data?.pendingOrdersCount || 0;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-surface-200 bg-white/95 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile Sidebar toggle & Search Bar */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="lg:hidden p-2 rounded-lg text-surface-600 hover:bg-surface-100"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center justify-between w-full max-w-md px-3.5 py-1.5 text-xs text-surface-400 bg-surface-50 hover:bg-surface-100 border border-surface-200 rounded-xl transition-all"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-surface-400" />
            <span>Search bill, customer, barcode...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono bg-white border border-surface-200 rounded shadow-xs text-surface-500 font-semibold">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Live Gold Rate Board Ticker */}
        <button
          type="button"
          onClick={onOpenGoldRates}
          className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-gold-50/80 hover:bg-gold-100/80 border border-gold-200 text-xs text-gold-900 transition-colors shadow-xs"
        >
          <div className="p-1 rounded-md bg-gold-500 text-white">
            <Coins className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gold-950">24K: {formatCurrency(rate24K)}/g</span>
            <span className="text-gold-400">|</span>
            <span className="font-semibold text-gold-950">22K: {formatCurrency(rate22K)}/g</span>
            <span className="text-gold-400">|</span>
            <span className="font-semibold text-surface-600">Ag: {formatCurrency(rateSilver)}/g</span>
          </div>
        </button>

        {/* Attention Alerts / Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="relative p-2 rounded-xl text-surface-600 hover:bg-surface-100 hover:text-surface-900 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {pendingOrders > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-gold-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white shadow-xl border border-surface-200 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between px-4 pb-2 border-b border-surface-100">
                <span className="text-xs font-bold uppercase tracking-wider text-surface-700">Attention Required</span>
                <span className="text-[10px] bg-gold-50 text-gold-800 font-semibold px-2 py-0.5 rounded-full border border-gold-200">
                  Live Alerts
                </span>
              </div>
              <div className="divide-y divide-surface-50 text-xs">
                <div
                  onClick={() => {
                    navigate('/orders');
                    setShowNotifications(false);
                  }}
                  className="p-3 hover:bg-surface-50 cursor-pointer flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-surface-800">{pendingOrders} Manufacturing Jobs Pending</p>
                    <p className="text-[11px] text-surface-400 mt-0.5">Custom orders waiting for delivery or QC</p>
                  </div>
                </div>
                <div
                  onClick={() => {
                    navigate('/reports/sales');
                    setShowNotifications(false);
                  }}
                  className="p-3 hover:bg-surface-50 cursor-pointer flex items-start gap-2.5"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-surface-800">Branch Cash Counter Active</p>
                    <p className="text-[11px] text-surface-400 mt-0.5">Day register opened for billing</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Branch Display */}
        {branch && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-100 border border-surface-200 text-xs text-surface-700 font-medium">
            <Building className="w-3.5 h-3.5 text-surface-500" />
            <span className="truncate max-w-[130px]">{branch.code || branch.name || 'Main Branch'}</span>
          </div>
        )}

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-surface-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gold-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-surface-900 leading-tight">{user?.name || 'Administrator'}</p>
              <p className="text-[10px] text-gold-700 font-semibold">{role.replace('_', ' ')}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-surface-400 hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white shadow-xl border border-surface-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-surface-100 text-xs">
                <p className="font-bold text-surface-900">{user?.name}</p>
                <p className="text-surface-500 truncate">{user?.email}</p>
                <span className="inline-block mt-1 text-[10px] bg-gold-50 text-gold-800 font-semibold px-2 py-0.5 rounded border border-gold-200">
                  {role}
                </span>
              </div>
              <div className="py-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/settings');
                    setShowUserMenu(false);
                  }}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-surface-700 hover:bg-surface-50"
                >
                  <User className="w-4 h-4 text-surface-400" />
                  Account Settings
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-red-600 hover:bg-red-50 font-semibold"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
