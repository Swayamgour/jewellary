import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Tabs = ({ tabs, activeTab, onChange, className }) => {
  return (
    <div className={twMerge('flex border-b border-surface-200 gap-1 overflow-x-auto', className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all select-none',
              isActive
                ? 'border-gold-500 text-gold-700 bg-gold-50/50'
                : 'border-transparent text-surface-500 hover:text-surface-800 hover:border-surface-300'
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={clsx(
                  'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                  isActive ? 'bg-gold-200 text-gold-900 font-bold' : 'bg-surface-200 text-surface-700'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
