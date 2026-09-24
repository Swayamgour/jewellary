import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Card = ({
  children,
  className,
  title,
  subtitle,
  action,
  headerClassName,
  bodyClassName,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        'bg-white rounded-2xl border border-surface-200/80 shadow-sm overflow-hidden transition-all',
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div
          className={twMerge(
            'flex items-center justify-between px-6 py-4 border-b border-surface-100 bg-surface-50/30',
            headerClassName
          )}
        >
          <div>
            {title && <h3 className="text-base font-bold text-surface-900 font-display">{title}</h3>}
            {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={twMerge('p-6', bodyClassName)}>{children}</div>
    </div>
  );
};
