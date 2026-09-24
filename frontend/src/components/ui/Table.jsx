import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Table = ({
  headers = [],
  children,
  className,
  stickyHeader = false
}) => {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-surface-200">
      <table className={twMerge('w-full text-left text-sm text-surface-800', className)}>
        {headers.length > 0 && (
          <thead
            className={clsx(
              'bg-surface-50 text-xs uppercase font-semibold text-surface-600 border-b border-surface-200',
              stickyHeader && 'sticky top-0 z-10'
            )}
          >
            <tr>
              {headers.map((h, idx) => (
                <th
                  key={idx}
                  className={twMerge(
                    'px-4 py-3 tracking-wider whitespace-nowrap',
                    h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left',
                    h.className
                  )}
                >
                  {h.label || h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-surface-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
};

export const TableRow = ({ children, className, onClick, ...props }) => {
  return (
    <tr
      onClick={onClick}
      className={twMerge(
        'transition-colors hover:bg-surface-50/80',
        onClick && 'cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
};

export const TableCell = ({ children, className, align = 'left', ...props }) => {
  const aligns = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };

  return (
    <td className={twMerge('px-4 py-3 whitespace-nowrap', aligns[align], className)} {...props}>
      {children}
    </td>
  );
};
