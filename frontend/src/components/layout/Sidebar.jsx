import React from 'react';
import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Receipt,
  ShoppingCart,
  Truck,
  Package,
  Users,
  Briefcase,
  CreditCard,
  RefreshCw,
  Clock,
  ArrowDownCircle,
  BarChart3,
  Coins,
  Settings,
  X,
  Plus
} from 'lucide-react';

const navigationItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Billing / POS', path: '/billing', icon: Receipt, actionPath: '/billing/new' },
  { name: 'Sales Orders', path: '/sales', icon: ShoppingCart },
  { name: 'Purchases', path: '/purchases', icon: Truck },
  { name: 'Inventory & Stock', path: '/inventory', icon: Package },
  { name: 'Customers', path: '/customers', icon: Users },
  { name: 'Vendors', path: '/vendors', icon: Briefcase },
  { name: 'Payments & Cash', path: '/payments', icon: CreditCard },
  { name: 'Old Gold / Exchange', path: '/exchange', icon: RefreshCw },
  { name: 'Custom Orders', path: '/orders', icon: Clock },
  { name: 'Expenses', path: '/expenses', icon: ArrowDownCircle },
  { name: 'Reports Center', path: '/reports', icon: BarChart3 },
  { name: 'Gold Rates', path: '/gold-rates', icon: Coins },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-surface-950/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-surface-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-surface-100 bg-surface-50/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white shadow-md shadow-gold-500/20">
              <Coins className="w-5 h-5 text-surface-950" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-surface-900 font-display">AURA JEWEL</span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-gold-700">Enterprise ERP</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-surface-400 hover:bg-surface-100 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-surface-400">
            Operations & POS
          </div>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.path} className="flex items-center group">
                <NavLink
                  to={item.path}
                  onClick={() => {
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={({ isActive }) =>
                    clsx(
                      'flex flex-1 items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all select-none',
                      isActive
                        ? 'bg-gold-50 text-gold-900 font-bold border border-gold-200/80 shadow-xs'
                        : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                    )
                  }
                >
                  <Icon className="w-4 h-4 text-surface-500 group-hover:text-gold-600 transition-colors shrink-0" />
                  <span className="truncate">{item.name}</span>
                </NavLink>

                {item.actionPath && (
                  <NavLink
                    to={item.actionPath}
                    title="Quick New Bill"
                    className="ml-1 p-1.5 rounded-lg text-surface-400 hover:bg-gold-100 hover:text-gold-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </NavLink>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Info: POS Shortcut Guide */}
        <div className="p-4 border-t border-surface-100 bg-surface-50/50">
          <div className="rounded-xl p-3 bg-surface-100 border border-surface-200/60 text-center">
            <span className="text-[11px] font-bold text-surface-800">POS Hotkeys Ready</span>
            <div className="flex justify-center gap-2 mt-1.5 text-[10px] font-mono text-surface-600">
              <span className="bg-white px-1.5 py-0.5 rounded border border-surface-200">F2: Bill</span>
              <span className="bg-white px-1.5 py-0.5 rounded border border-surface-200">F4: Customer</span>
              <span className="bg-white px-1.5 py-0.5 rounded border border-surface-200">F6: Item</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
