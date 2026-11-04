import { TrophyIcon, ChevronLeftIcon } from '@/components/icons/Icons'
import { useRouter } from '@/context/RouterContext'

interface HeaderProps {
  onRequestToAddClick: () => void
  communityName?: string
  communitySlug?: string
}

export function Header({ onRequestToAddClick, communityName }: HeaderProps) {
  const { navigate } = useRouter()

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-md bg-amber-50 border border-amber-200 text-[#F89F1B] cursor-pointer"
              onClick={() => navigate('/communities')}
              title="View all communities"
            >
              <TrophyIcon className="w-5 h-5" />
            </div>
            <div>
              <span
                className="text-lg font-bold tracking-tight text-gray-900 cursor-pointer"
                onClick={() => navigate('/communities')}
              >
                LeetCode <span className="text-[#F89F1B]">Leaderboard</span>
              </span>
              <span className="hidden sm:inline-block ml-2.5 px-2.5 py-0.5 text-xs font-semibold text-gray-700 bg-amber-50/80 rounded-full border border-amber-200">
                {communityName || 'Community'}
              </span>
            </div>
          </div>

          {/* Actions: Browse Communities + Locked exact label "Request to Add" */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/communities')}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
              <span>All Communities</span>
            </button>

            <button
              type="button"
              onClick={onRequestToAddClick}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#F89F1B] hover:bg-[#D97706] active:bg-amber-700 rounded-md shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F89F1B] cursor-pointer"
            >
              Request to Add
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
