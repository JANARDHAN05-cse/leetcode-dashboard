import { useState, useEffect } from 'react'
import type { Community } from '@/types'
import { getCommunities } from '@/services/api'
import { useRouter } from '@/context/RouterContext'
import { CreateCommunityModal } from '@/components/community/CreateCommunityModal'
import {
  TrophyIcon,
  SearchIcon,
  PlusIcon,
  UsersIcon,
  ExternalLinkIcon,
} from '@/components/icons/Icons'

export function CommunityDirectory() {
  const [communities, setCommunities] = useState<Community[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { navigate } = useRouter()

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        setIsLoading(true)
        const data = await getCommunities(search)
        if (isMounted) {
          setCommunities(data)
          setError(null)
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load communities.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    const timer = setTimeout(() => {
      load()
    }, 250)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [search])

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-between">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/communities')}>
            <div className="w-10 h-10 rounded-lg bg-[#F89F1B]/10 flex items-center justify-center text-[#F89F1B]">
              <TrophyIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-gray-900 tracking-tight">LeetCode Leaderboard</span>
                <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Platform
                </span>
              </div>
              <p className="text-xs text-gray-500 hidden sm:block">
                Browse independent competitive programming communities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#F89F1B] hover:bg-[#D97706] rounded-md transition-colors shadow-xs cursor-pointer"
            >
              <PlusIcon className="w-4 h-4 text-white" />
              <span>Request Community</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Banner */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
              Community Directory
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-2xl">
              Discover dedicated LeetCode leaderboards for colleges, companies, placement groups, and coding clubs.
              Join a community or request your own.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <SearchIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search communities..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F89F1B] bg-white text-gray-800"
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Communities Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white p-5 rounded-lg border border-gray-200 animate-pulse space-y-3">
                <div className="h-5 bg-gray-200 rounded w-2/3"></div>
                <div className="h-3 bg-gray-100 rounded w-full"></div>
                <div className="h-3 bg-gray-100 rounded w-4/5"></div>
                <div className="pt-4 flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                  <div className="h-7 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        ) : communities.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl border border-gray-200 shadow-xs space-y-3">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
              <UsersIcon className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">No communities found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {search
                ? `No community matched "${search}". Try searching with different keywords or request a new community.`
                : 'There are currently no active communities listed. Be the first to establish one!'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#F89F1B] hover:bg-[#D97706] rounded-md transition-colors cursor-pointer"
              >
                <PlusIcon className="w-4 h-4 text-white" />
                <span>Request a Community</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {communities.map((comm) => (
              <div
                key={comm.id}
                className="bg-white p-5 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-bold text-gray-900 tracking-tight">
                      {comm.name}
                    </h2>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                      <UsersIcon className="w-3 h-3 text-gray-500" />
                      <span>{comm.member_count ?? 0}</span>
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                    {comm.description || 'Community LeetCode leaderboard tracking competitive programming progress.'}
                  </p>
                </div>

                <div className="pt-5 mt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-gray-400">
                    /{comm.slug}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/communities/${comm.slug}`)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-800 bg-gray-50 hover:bg-[#F89F1B] hover:text-white border border-gray-200 hover:border-transparent rounded-md transition-colors cursor-pointer"
                  >
                    <span>Leaderboard</span>
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          LeetCode Leaderboard Multi-Community Platform • Verified Real Profile Statistics
        </div>
      </footer>

      {/* Request Community Modal */}
      <CreateCommunityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          // reload communities after request submitted if desired
        }}
      />
    </div>
  )
}
