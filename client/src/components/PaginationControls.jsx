import React from 'react';

/**
 * PaginationControls
 * ──────────────────
 * Standardized pagination bar for tables and lists.
 */
export default function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  limit,
  onPageChange,
  itemName = 'items',
}) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-4 bg-white dark:bg-[#111827] border-t border-slate-200 dark:border-slate-800 rounded-b-xl text-xs transition-colors">
      <div className="text-slate-500 dark:text-slate-400">
        Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{startItem}</span> to{' '}
        <span className="font-semibold text-slate-800 dark:text-slate-200">{endItem}</span> of{' '}
        <span className="font-semibold text-slate-800 dark:text-slate-200">{totalItems}</span> {itemName}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition cursor-pointer"
        >
          Previous
        </button>

        <span className="text-slate-600 dark:text-slate-400 px-2 font-medium">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition cursor-pointer"
        >
          Next
        </button>
      </div>
    </div>
  );
}
