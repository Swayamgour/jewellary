import React from 'react';
import { PackageOpen } from 'lucide-react';
import { Button } from './Button';

export const EmptyState = ({
  icon: Icon = PackageOpen,
  title = 'No Records Found',
  description = 'There are no items to display at this moment.',
  actionLabel,
  onAction,
  className
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed border-surface-200 bg-white/60 ${className || ''}`}>
      <div className="p-4 rounded-2xl bg-gold-50 text-gold-600 mb-4 border border-gold-100">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-base font-bold text-surface-900 font-display">{title}</h3>
      <p className="text-sm text-surface-500 max-w-sm mt-1 mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
