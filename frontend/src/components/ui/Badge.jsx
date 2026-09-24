import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  className
}) => {
  const baseStyles = 'inline-flex items-center font-semibold rounded-full uppercase tracking-wider select-none';

  const variants = {
    default: 'bg-surface-100 text-surface-700 border border-surface-200',
    gold: 'bg-gold-50 text-gold-800 border border-gold-300',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-red-50 text-red-700 border border-red-200',
    info: 'bg-sky-50 text-sky-700 border border-sky-200',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200',
    kacha: 'bg-orange-50 text-orange-800 border border-orange-300 font-bold',
    pakka: 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold'
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  return (
    <span className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}>
      {children}
    </span>
  );
};
