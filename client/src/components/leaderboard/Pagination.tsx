import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons/Icons'

interface PaginationProps {
  page: number
  totalPages: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

const LIMIT_OPTIONS = [10, 25, 50, 100]

export function Pagination({
  page,
  totalPages,
  limit,
  total,
  onPageChange,
  onLimitChange,
}: PaginationProps) {
  if (total === 0) return null

  const startItem = (page - 1) * limit + 1
  const endItem = Math.min(page * limit, total)

  // Generate page numbers to show
  function getPageNumbers(): (number | 'ellipsis')[] {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: (number | 'ellipsis')[] = [1]
    if (page > 3) {
      pages.push('ellipsis')
    }

    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (page < totalPages - 2) {
      pages.push('ellipsis')
    }
    pages.push(totalPages)

    return pages
  }

  const pages = getPageNumbers()

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2 text-sm text-gray-600">
      {/* 1. Showing results & rows-per-page */}
      <div className="flex items-center gap-3 order-2 sm:order-1">
        <span className="text-xs text-gray-500">
          Showing <span className="font-medium text-gray-800">{startItem}</span> to{' '}
          <span className="font-medium text-gray-800">{endItem}</span> of{' '}
          <span className="font-medium text-gray-800">{total}</span> users
        </span>

        <div className="flex items-center gap-1.5 ml-2">
          <label htmlFor="limit-select" className="text-xs text-gray-400">
            Per page:
          </label>
          <select
            id="limit-select"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#F89F1B] focus:border-[#F89F1B]"
          >
            {LIMIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Navigation Controls */}
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center justify-center p-1.5 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous Page"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-400">
                  …
                </span>
              )
            }
            const isCurrent = p === page
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[32px] h-8 px-2 text-xs font-semibold rounded-md transition-colors ${
                  isCurrent
                    ? 'bg-[#F89F1B] text-white'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                {p}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center justify-center p-1.5 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next Page"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

