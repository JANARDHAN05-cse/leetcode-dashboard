import type { LeaderboardUser } from '@/types'
import { ExternalLinkIcon, AlertTriangleIcon } from '@/components/icons/Icons'
import { Badge } from '@/components/shared/Badge'

interface UserRowProps {
  user: LeaderboardUser
  rank: number
}

// 24 hours threshold in milliseconds for stale statistics warning
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000

function formatTimeAgo(isoString: string | null): { text: string; isStale: boolean } {
  if (!isoString) {
    return { text: '—', isStale: true }
  }

  const timestamp = new Date(isoString).getTime()
  if (isNaN(timestamp)) {
    return { text: '—', isStale: false }
  }

  const diffMs = Date.now() - timestamp
  const isStale = diffMs > STALE_THRESHOLD_MS

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  let text: string
  if (days > 0) {
    text = `${days}d ago`
  } else if (hours > 0) {
    text = `${hours}h ago`
  } else if (minutes > 0) {
    text = `${minutes}m ago`
  } else {
    text = 'Just now'
  }

  return { text, isStale }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/[\s_-]+/)
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function UserRow({ user, rank }: UserRowProps) {
  const refreshInfo = formatTimeAgo(user.last_refreshed_at)
  const isSyncError = user.fetch_status === 'error'

  // Rank badge styling
  const rankBadge =
    rank === 1 ? (
      <Badge variant="rank-gold">1</Badge>
    ) : rank === 2 ? (
      <Badge variant="rank-silver">2</Badge>
    ) : rank === 3 ? (
      <Badge variant="rank-bronze">3</Badge>
    ) : (
      <span className="text-sm font-semibold text-gray-500">{rank}</span>
    )

  return (
    <tr className="hover:bg-gray-50/80 transition-colors border-b border-gray-100 last:border-b-0">
      {/* 1. Rank */}
      <td className="px-4 py-3.5 whitespace-nowrap text-center sm:text-left w-14">
        {rankBadge}
      </td>

      {/* 2. User Profile */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-3">
          {/* Avatar with fallback */}
          <div className="relative shrink-0">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="w-9 h-9 rounded-full object-cover border border-gray-200"
                onError={(e) => {
                  // Fallback on image load error
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextElementSibling?.classList.remove('hidden')
                }}
              />
            ) : null}
            <div
              className={`w-9 h-9 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center border border-amber-200 ${
                user.avatar_url ? 'hidden' : ''
              }`}
            >
              {getInitials(user.display_name || user.leetcode_username)}
            </div>
          </div>

          {/* Name & Handle */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <a
                href={`https://leetcode.com/${encodeURIComponent(user.leetcode_username)}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-gray-900 hover:text-[#F89F1B] transition-colors truncate flex items-center gap-1 group font-mono"
              >
                <span>{user.leetcode_username}</span>
                <ExternalLinkIcon className="opacity-0 group-hover:opacity-100 text-gray-400 w-3 h-3 transition-opacity" />
              </a>
            </div>
            {user.display_name ? (
              <span className="text-xs text-gray-500 truncate max-w-[180px]">
                {user.display_name}
              </span>
            ) : null}
          </div>
        </div>
      </td>

      {/* 3. Solved Total + Difficulty Breakdown */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-900">
            {user.solved_total !== null ? user.solved_total.toLocaleString() : '—'}
          </span>
          {user.solved_total !== null && (
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
              <span className="text-emerald-600 font-medium" title="Easy Solved">
                {user.solved_easy ?? '—'}
              </span>
              <span className="text-gray-300">/</span>
              <span className="text-amber-600 font-medium" title="Medium Solved">
                {user.solved_medium ?? '—'}
              </span>
              <span className="text-gray-300">/</span>
              <span className="text-rose-600 font-medium" title="Hard Solved">
                {user.solved_hard ?? '—'}
              </span>
            </div>
          )}
        </div>
      </td>

      {/* 4. Contest Rating */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <span className="text-sm font-medium text-gray-900">
          {user.contest_rating !== null
            ? Math.round(user.contest_rating).toLocaleString()
            : '—'}
        </span>
      </td>

      {/* 5. Contests Attended (Confirmed 0 displays as 0, null displays as —) */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <span className="text-sm text-gray-800">
          {user.contests_attended !== null ? user.contests_attended : '—'}
        </span>
      </td>

      {/* 6. Last Refresh Info + Stale Indicator */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-xs ${
              refreshInfo.isStale || isSyncError
                ? 'text-amber-700 font-medium'
                : 'text-gray-500'
            }`}
          >
            {refreshInfo.text}
          </span>
          {(refreshInfo.isStale || isSyncError) && (
            <span
              title={
                isSyncError
                  ? 'Last sync encountered an error. Showing cached data.'
                  : 'Data has not refreshed in over 24 hours.'
              }
            >
              <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}
