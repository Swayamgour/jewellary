import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TrendingUp, TrendingDown } from 'lucide-react';

export const StatCard = ({
  title,
  value,
  trend,
  trendType = 'up', // 'up' | 'down' | 'neutral'
  subtitle,
  icon: Icon,
  variant = 'default', // 'default' | 'gold' | 'emerald' | 'amber' | 'rose'
  className
}) => {
  const iconBgStyles = {
    default: 'bg-surface-100 text-surface-700',
    gold: 'bg-gold-50 text-gold-600 border border-gold-200/60',
    emerald: 'bg-emerald-50 text-emerald-600 border border-emerald-200/60',
    amber: 'bg-amber-50 text-amber-600 border border-amber-200/60',
    rose: 'bg-rose-50 text-rose-600 border border-rose-200/60',
  };

  return (
    <div
      className={twMerge(
        'relative bg-white rounded-2xl border border-surface-200/80 p-5 shadow-sm hover:shadow-md transition-all group overflow-hidden',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">{title}</p>
          <h4 className="text-2xl font-extrabold text-surface-900 mt-2 font-display tracking-tight">{value}</h4>
        </div>
        {Icon && (
          <div className={twMerge('p-3 rounded-xl transition-transform group-hover:scale-105', iconBgStyles[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {(trend || subtitle) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-100 text-xs">
          {trend && (
            <span
              className={clsx(
                'inline-flex items-center gap-0.5 font-semibold',
                trendType === 'up' && 'text-emerald-600',
                trendType === 'down' && 'text-rose-600',
                trendType === 'neutral' && 'text-surface-500'
              )}
            >
              {trendType === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
              {trendType === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
              {trend}
            </span>
          )}
          {subtitle && <span className="text-surface-400">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
