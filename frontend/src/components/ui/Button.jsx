import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export const Button = React.forwardRef(({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon: Icon,
  type = 'button',
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variants = {
    primary: 'bg-gold-500 hover:bg-gold-600 text-white shadow-sm focus:ring-gold-400',
    secondary: 'bg-surface-800 hover:bg-surface-900 text-white focus:ring-surface-600',
    outline: 'border border-surface-300 bg-white hover:bg-surface-50 text-surface-700 focus:ring-gold-400',
    ghost: 'text-surface-600 hover:bg-surface-100 hover:text-surface-900 focus:ring-surface-400',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-400',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-400',
    goldSoft: 'bg-gold-50 text-gold-800 hover:bg-gold-100 border border-gold-200'
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
    icon: 'p-2'
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
