import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Works with the API's { page, limit, total, totalPages } object. Renders nothing for a single page. */
export const Pagination = ({ pagination, onPage }) => {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;
  return (
    <div className="flex items-center justify-between pt-3 text-xs text-surface-500">
      <span>Page {page} of {totalPages} · {total} records</span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="p-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="p-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 disabled:opacity-40">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
