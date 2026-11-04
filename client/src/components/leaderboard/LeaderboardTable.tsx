import type { LeaderboardUser, RankingMetric } from '@/types'
import { UserRow } from './UserRow'
import { TableRowSkeleton } from '@/components/shared/Skeleton'
import { AlertTriangleIcon, SearchIcon } from '@/components/icons/Icons'

interface LeaderboardTableProps {
  users: LeaderboardUser[]
  isLoading: boolean
  error: string | null
  activeMetric: RankingMetric
  searchQuery: string
  page: number
  limit: number
  onRetry: () => void
  onClearSearch: () => void
}

export function LeaderboardTable({
  users,
  isLoading,
  error,
  activeMetric,
  searchQuery,
  page,
  limit,
  onRetry,
  onClearSearch,
}: LeaderboardTableProps) {
  // Error state
  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-lg p-6 my-6 text-center">
        <div className="flex justify-center mb-2">
          <AlertTriangleIcon className="w-8 h-8 text-rose-500" />
        </div>
        <h3 className="text-base font-semibold text-rose-900 mb-1">
          Unable to Load Leaderboard
        </h3>
        <p className="text-sm text-rose-700 mb-4">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
        >
          Try Again
        </button>
      </div>
    )
  }

  // Calculate starting rank offset for current page
  const startRank = (page - 1) * limit + 1

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" role="table">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th scope="col" className="px-4 py-3.5 text-center sm:text-left w-14">
                #
              </th>
              <th scope="col" className="px-4 py-3.5 min-w-[200px]">
                User
              </th>
              <th
                scope="col"
                className={`px-4 py-3.5 ${
                  activeMetric === 'solved_total' ? 'text-[#F89F1B] font-bold' : ''
                }`}
              >
                Solved
              </th>
              <th
                scope="col"
                className={`px-4 py-3.5 ${
                  activeMetric === 'contest_rating' ? 'text-[#F89F1B] font-bold' : ''
                }`}
              >
                Rating
              </th>
              <th
                scope="col"
                className={`px-4 py-3.5 ${
                  activeMetric === 'contests_attended' ? 'text-[#F89F1B] font-bold' : ''
                }`}
              >
                Contests
              </th>
              <th scope="col" className="px-4 py-3.5">
                Last Refresh
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              // Loading Skeleton State (10 rows)
              Array.from({ length: 8 }).map((_, idx) => (
                <TableRowSkeleton key={idx} />
              ))
            ) : users.length > 0 ? (
              // Active User Rows
              users.map((user, idx) => (
                <UserRow
                  key={user.id}
                  user={user}
                  rank={startRank + idx}
                />
              ))
            ) : (
              // Empty State
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                  {searchQuery ? (
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="flex justify-center text-gray-400 mb-2">
                        <SearchIcon className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        No users match your search
                      </p>
                      <p className="text-xs text-gray-500">
                        No results found for &ldquo;<span className="font-medium text-gray-700">{searchQuery}</span>&rdquo;.
                      </p>
                      <button
                        type="button"
                        onClick={onClearSearch}
                        className="mt-2 text-xs font-semibold text-[#F89F1B] hover:text-[#D97706] transition-colors"
                      >
                        Clear search filter
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-700">
                        No users on the leaderboard yet.
                      </p>
                      <p className="text-xs text-gray-400">
                        Click &ldquo;Request to Add&rdquo; above to submit the first profile.
                      </p>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

