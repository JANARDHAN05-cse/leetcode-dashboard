import { useState, useEffect } from 'react'
import type { RankingMetric, LeaderboardUser, PaginationMeta, Community } from '@/types'
import { Header } from '@/components/leaderboard/Header'
import { FilterTabs } from '@/components/leaderboard/FilterTabs'
import { SearchBar } from '@/components/leaderboard/SearchBar'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import { Pagination } from '@/components/leaderboard/Pagination'
import { RequestModal } from '@/components/leaderboard/RequestModal'
import { getCommunityLeaderboard } from '@/services/api'
import { useRouter } from '@/context/RouterContext'

interface PublicLeaderboardProps {
  communitySlug?: string
}

export function PublicLeaderboard({ communitySlug }: PublicLeaderboardProps) {
  const { path } = useRouter()

  // Extract slug from URL if path is /communities/:slug, or prop, or default to 'joyboys'
  const match = path.match(/^\/communities\/([a-zA-Z0-9_-]+)/)
  const activeSlug: string = communitySlug || (match && match[1]) || 'joyboys'

  const [community, setCommunity] = useState<Community | null>(null)
  const [activeMetric, setActiveMetric] = useState<RankingMetric>('solved_total')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)

  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    total_pages: 1,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Fetch community-scoped leaderboard data
  useEffect(() => {
    let isMounted = true

    async function fetchData() {
      try {
        const data = await getCommunityLeaderboard(activeSlug, {
          metric: activeMetric,
          search: searchQuery,
          page,
          limit,
        })
        if (isMounted) {
          setCommunity(data.community)
          setUsers(data.users)
          setPagination(data.pagination)
          setError(null)
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load leaderboard data. Please try again.'
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [activeSlug, activeMetric, searchQuery, page, limit, refreshTrigger])

  // Handlers
  function handleMetricChange(newMetric: RankingMetric) {
    setIsLoading(true)
    setActiveMetric(newMetric)
    setPage(1)
  }

  function handleSearchChange(newSearch: string) {
    setIsLoading(true)
    setSearchQuery(newSearch)
    setPage(1)
  }

  function handleLimitChange(newLimit: number) {
    setIsLoading(true)
    setLimit(newLimit)
    setPage(1)
  }

  function handlePageChange(newPage: number) {
    setIsLoading(true)
    setPage(newPage)
  }

  function handleRetry() {
    setIsLoading(true)
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between">
      <div>
        {/* 1. Header (with exact "Request to Add" button) */}
        <Header
          onRequestToAddClick={() => setIsRequestModalOpen(true)}
          communityName={community?.name}
          communitySlug={activeSlug}
        />

        {/* 2. Main Page Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
          {/* Community Title & Overview Banner */}
          <div className="border-b border-gray-200 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                  {community ? `${community.name} Leaderboard` : 'Community Rankings'}
                </h1>
                <p className="mt-1 text-sm text-gray-500 max-w-3xl">
                  {community?.description ||
                    'Real-time standings based on verified public LeetCode profiles. Solve problems and climb the ranks.'}
                </p>
              </div>

              {community?.member_count !== undefined && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-full self-start sm:self-center border border-gray-200">
                  <span>{community.member_count} Members</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Controls Bar: Filters & Search */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Filter Tabs: Exactly 3 metrics */}
            <FilterTabs
              activeMetric={activeMetric}
              onMetricChange={handleMetricChange}
            />

            {/* Search Input */}
            <div className="w-full lg:w-72">
              <SearchBar
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search username or display name..."
              />
            </div>
          </div>

          {/* 4. Leaderboard Table */}
          <LeaderboardTable
            users={users}
            isLoading={isLoading}
            error={error}
            activeMetric={activeMetric}
            searchQuery={searchQuery}
            page={page}
            limit={limit}
            onRetry={handleRetry}
            onClearSearch={() => handleSearchChange('')}
          />

          {/* 5. Pagination */}
          {!isLoading && !error && users.length > 0 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.total_pages}
              limit={pagination.limit}
              total={pagination.total}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          )}
        </main>
      </div>

      {/* 6. Footer */}
      <footer className="mt-auto border-t border-gray-200 bg-gray-50 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          LeetCode Leaderboard • {community?.name || 'Community'} Progress Tracker • Verified Statistics
        </div>
      </footer>

      {/* 7. Modal: Request to Add (with inline profile validation) */}
      <RequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        communitySlug={activeSlug}
        communityName={community?.name}
      />
    </div>
  )
}
