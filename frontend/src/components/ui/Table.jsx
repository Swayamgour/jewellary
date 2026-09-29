import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Table = ({
  headers = [],
  children,
  className,
  stickyHeader = false,
}) => {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-surface-200">
      <table
        className={twMerge(
          'w-full text-left text-sm text-surface-800',
          className
        )}
      >
        {headers.length > 0 && (
          <thead
            className={clsx(
              'bg-surface-50 text-xs uppercase font-semibold text-surface-600 border-b border-surface-200',
              stickyHeader && 'sticky top-0 z-10'
            )}
          >
            <tr>
              {headers.map((header, idx) => {
                // Support both:
                // "Company"
                // { label: "Balance", align: "right" }

                const isObject =
                  header !== null &&
                  typeof header === 'object' &&
                  !Array.isArray(header);

                const label = isObject
                  ? header.label ?? ''
                  : header;

                const align = isObject
                  ? header.align ?? 'left'
                  : 'left';

                const headerClassName = isObject
                  ? header.className ?? ''
                  : '';

                const width = isObject
                  ? header.width
                  : undefined;

                return (
                  <th
                    key={idx}
                    style={width ? { width } : undefined}
                    className={twMerge(
                      'px-4 py-3 tracking-wider whitespace-nowrap',
                      align === 'right'
                        ? 'text-right'
                        : align === 'center'
                          ? 'text-center'
                          : 'text-left',
                      headerClassName
                    )}
                  >
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
        )}

        <tbody className="divide-y divide-surface-100 bg-white">
          {children}
        </tbody>
      </table>
    </div>
  );
};

export const TableRow = ({
  children,
  className,
  onClick,
  ...props
}) => {
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

export const TableCell = ({
  children,
  className,
  align = 'left',
  ...props
}) => {
  const aligns = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <td
      className={twMerge(
        'px-4 py-3 whitespace-nowrap',
        aligns[align] || aligns.left,
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
};