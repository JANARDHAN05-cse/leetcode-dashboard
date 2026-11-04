import { useState, useEffect } from 'react'
import type { LeaderboardUser, PaginationMeta, RankingMetric, Community } from '@/types'
import type { RefreshJobStatus } from '@/types/admin'
import { adminApi, AdminApiError } from '@/services/admin-api'
import { useRouter } from '@/context/RouterContext'
import { AddUserModal } from '@/components/admin/AddUserModal'
import { ConfirmModal } from '@/components/admin/ConfirmModal'
import { TableRowSkeleton } from '@/components/shared/Skeleton'
import {
  ArrowLeftIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  CheckCircleIcon,
  UsersIcon,
} from '@/components/icons/Icons'

interface CommunityMembersPageProps {
  slug: string
}

export function CommunityMembersPage({ slug }: CommunityMembersPageProps) {
  const { navigate } = useRouter()

  const [community, setCommunity] = useState<Community | null>(null)
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    total_pages: 1,
  })
  const [metric, setMetric] = useState<RankingMetric>('solved_total')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 25
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Modals & User Actions
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [userToRemove, setUserToRemove] = useState<LeaderboardUser | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [refreshingUserId, setRefreshingUserId] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Batch Refresh State for this Community
  const [isBatchRefreshing, setIsBatchRefreshing] = useState(false)
  const [batchJob, setBatchJob] = useState<RefreshJobStatus | null>(null)
  const [batchSummary, setBatchSummary] = useState<{
    total: number
    successful: number
    failed: number
  } | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadMembers() {
      try {
        const data = await adminApi.getCommunityMembers(slug, {
          sort: metric,
          search,
          page,
          limit,
        })
        if (isMounted) {
          setCommunity(data.community)
          setUsers(data.users)
          setPagination(data.pagination)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch community members.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadMembers()

    return () => {
      isMounted = false
    }
  }, [slug, metric, search, page, limit, refreshTrigger])

  const triggerRefresh = () => {
    setIsLoading(true)
    setRefreshTrigger((prev) => prev + 1)
  }

  // Check if a community refresh job is already running
  useEffect(() => {
    let isMounted = true

    adminApi
      .getRefreshCommunityStatus(slug)
      .then((status) => {
        if (!isMounted) return
        if (status.status === 'running') {
          setIsBatchRefreshing(true)
          setBatchJob(status)
        }
      })
      .catch(() => {
        // Ignore status check errors
      })

    return () => {
      isMounted = false
    }
  }, [slug])

  // Poll refresh job status while running
  useEffect(() => {
    if (!isBatchRefreshing) return

    const interval = setInterval(async () => {
      try {
        const status = await adminApi.getRefreshCommunityStatus(slug)
        setBatchJob(status)

        if (status.status === 'completed' || status.status === 'idle') {
          setIsBatchRefreshing(false)
          setBatchSummary({
            total: status.total,
            successful: status.successful,
            failed: status.failed,
          })
          triggerRefresh()
          clearInterval(interval)
        }
      } catch {
        // Ignore polling errors
      }
    }, 1500)

    return () => clearInterval(interval)
  }, [isBatchRefreshing, slug])

  const handleRefreshAll = async () => {
    if (isBatchRefreshing) return
    setBatchSummary(null)
    setIsBatchRefreshing(true)

    try {
      const initialJob = await adminApi.refreshCommunity(slug)
      setBatchJob(initialJob)

      if (initialJob.status === 'completed') {
        setIsBatchRefreshing(false)
        setBatchSummary({
          total: initialJob.total,
          successful: initialJob.successful,
          failed: initialJob.failed,
        })
        triggerRefresh()
      }
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 'REFRESH_IN_PROGRESS') {
        setIsBatchRefreshing(true)
      } else {
        setStatusMessage(err instanceof AdminApiError ? err.message : 'Failed to start community refresh.')
        setTimeout(() => setStatusMessage(null), 5000)
        setIsBatchRefreshing(false)
      }
    }
  }

  const handleRemoveConfirm = async () => {
    if (!userToRemove || isBatchRefreshing) return
    setIsRemoving(true)
    try {
      await adminApi.removeCommunityMember(slug, userToRemove.id)
      setUserToRemove(null)
      triggerRefresh()
      setStatusMessage(`User '${userToRemove.leetcode_username}' has been removed from this community.`)
      setTimeout(() => setStatusMessage(null), 4000)
    } catch (err) {
      setStatusMessage(err instanceof AdminApiError ? err.message : 'Failed to remove member.')
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setIsRemoving(false)
    }
  }

  const handleRefreshUser = async (user: LeaderboardUser) => {
    if (isBatchRefreshing) return
    setRefreshingUserId(user.id)
    try {
      await adminApi.refreshCommunityMember(slug, user.id)
      triggerRefresh()
      setStatusMessage(`Refreshed statistics for '${user.leetcode_username}'.`)
      setTimeout(() => setStatusMessage(null), 4000)
    } catch (err) {
      setStatusMessage(err instanceof AdminApiError ? err.message : 'Refresh failed.')
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setRefreshingUserId(null)
    }
  }

  const startRank = (page - 1) * limit + 1

  return (
    <div className="space-y-6">
      {/* 1. Back Navigation & Header */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/admin/communities')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors mb-3 cursor-pointer"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          <span>Back to All Communities</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {community?.name || slug}
              </h1>
              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                /{slug}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              {community?.description || 'Manage members, synchronize statistics, or add users to this community.'}
            </p>
          </div>

          {/* Header Actions: Refresh All Members beside Add User */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isBatchRefreshing}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              title="Refresh statistics for all members in this community"
            >
              <RefreshCwIcon
                className={`w-3.5 h-3.5 text-gray-500 ${isBatchRefreshing ? 'animate-spin text-[#F89F1B]' : ''}`}
              />
              <span>{isBatchRefreshing ? 'Refreshing...' : 'Refresh All Members'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              disabled={isBatchRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F89F1B] hover:bg-[#D97706] rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <PlusIcon className="w-4 h-4 text-white" />
              <span>Add User</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Active Refresh Progress Banner */}
      {batchJob && isBatchRefreshing && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <RefreshCwIcon className="w-4 h-4 text-[#F89F1B] animate-spin shrink-0" />
            <span className="font-medium">
              Refreshing {batchJob.processed} of {batchJob.total} members in {community?.name || slug}
              {batchJob.currentUser ? (
                <span className="font-mono text-gray-700 ml-1">({batchJob.currentUser})</span>
              ) : null}
              ...
            </span>
          </div>
          <div className="text-xs text-amber-800 font-medium">
            <span className="text-emerald-700 font-semibold">{batchJob.successful} updated</span>
            {batchJob.failed > 0 && (
              <span className="text-rose-600 font-semibold ml-2">{batchJob.failed} failed</span>
            )}
          </div>
        </div>
      )}

      {/* 3. Refresh Completion Summary Banner */}
      {batchSummary && (
        <div
          className={`p-3.5 rounded-md text-xs border flex items-center justify-between shadow-xs ${
            batchSummary.failed > 0
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Community refresh completed: <strong>{batchSummary.successful}</strong> profiles updated,{' '}
              <strong>{batchSummary.failed}</strong> failed out of {batchSummary.total} members.
              {batchSummary.failed > 0 && (
                <span className="ml-1 text-gray-600">
                  (Previous statistics preserved for failed profiles; retry individually below)
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setBatchSummary(null)}
            className="text-xs font-semibold underline hover:opacity-80 cursor-pointer ml-3 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4. Action Status Banner */}
      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-emerald-800">
          {statusMessage}
        </div>
      )}

      {/* 5. Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={triggerRefresh}
            className="text-xs font-semibold underline hover:text-rose-900 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 6. Controls: Search Bar & Ranking Sort Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-gray-200 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search community members..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F89F1B] focus:bg-white"
          >
          </input>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="ranking-sort" className="text-xs font-medium text-gray-600 whitespace-nowrap">
            Rank by:
          </label>
          <select
            id="ranking-sort"
            value={metric}
            onChange={(e) => {
              setMetric(e.target.value as RankingMetric)
              setPage(1)
            }}
            className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F89F1B]"
          >
            <option value="solved_total">Problems Solved</option>
            <option value="contest_rating">Contest Rating</option>
            <option value="contests_attended">Contests Attended</option>
          </select>
        </div>
      </div>

      {/* 7. Members Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4 text-right">Solved Breakdown</th>
                <th className="py-3 px-4 text-right">Contest Rating</th>
                <th className="py-3 px-4 text-right">Contests</th>
                <th className="py-3 px-4 text-right">Last Refreshed</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <TableRowSkeleton key={idx} columns={7} />
                ))
              ) : users.length > 0 ? (
                users.map((user, idx) => {
                  const rank = startRank + idx
                  const isUserRefreshing = refreshingUserId === user.id

                  return (
                    <tr key={user.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Rank */}
                      <td className="py-3 px-4 text-center font-bold text-gray-400">
                        {rank === 1 ? (
                          <span className="text-amber-500 font-extrabold text-sm">#1</span>
                        ) : rank === 2 ? (
                          <span className="text-slate-400 font-extrabold text-sm">#2</span>
                        ) : rank === 3 ? (
                          <span className="text-amber-700 font-extrabold text-sm">#3</span>
                        ) : (
                          `#${rank}`
                        )}
                      </td>

                      {/* Avatar & Username Link */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              user.avatar_url ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(user.leetcode_username)}&background=FFA116&color=fff`
                            }
                            alt=""
                            className="w-7 h-7 rounded-full object-cover border border-gray-200 shrink-0"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.leetcode_username)}&background=FFA116&color=fff`
                            }}
                          />
                          <div className="min-w-0">
                            <a
                              href={`https://leetcode.com/u/${user.leetcode_username}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-gray-900 hover:text-[#F89F1B] transition-colors inline-flex items-center gap-1 group"
                            >
                              <span>{user.leetcode_username}</span>
                              <ExternalLinkIcon className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                            {user.display_name && (
                              <div className="text-[11px] text-gray-500 truncate">
                                {user.display_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Solved Breakdown */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-gray-900">{user.solved_total ?? '—'}</div>
                        <div className="text-[10px] text-gray-500 space-x-1.5 mt-0.5">
                          <span className="text-emerald-600 font-medium">{user.solved_easy ?? 0}E</span>
                          <span className="text-amber-600 font-medium">{user.solved_medium ?? 0}M</span>
                          <span className="text-rose-600 font-medium">{user.solved_hard ?? 0}H</span>
                        </div>
                      </td>

                      {/* Contest Rating */}
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        {user.contest_rating ? Math.round(Number(user.contest_rating)) : '—'}
                      </td>

                      {/* Contests Attended */}
                      <td className="py-3 px-4 text-right font-medium text-gray-900">
                        {user.contests_attended ?? '—'}
                      </td>

                      {/* Last Refreshed */}
                      <td className="py-3 px-4 text-right text-gray-400 text-[11px]">
                        {user.last_refreshed_at
                          ? new Date(user.last_refreshed_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </td>

                      {/* Row Actions: Individual Refresh + Remove from Community */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRefreshUser(user)}
                            disabled={isUserRefreshing || isBatchRefreshing}
                            className="p-1.5 text-gray-400 hover:text-[#F89F1B] hover:bg-gray-100 rounded transition-colors disabled:opacity-40 cursor-pointer"
                            title={`Refresh ${user.leetcode_username}`}
                          >
                            <RefreshCwIcon
                              className={`w-3.5 h-3.5 ${isUserRefreshing ? 'animate-spin text-[#F89F1B]' : ''}`}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() => setUserToRemove(user)}
                            disabled={isBatchRefreshing}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-40 cursor-pointer"
                            title={`Remove ${user.leetcode_username} from community`}
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <UsersIcon className="w-8 h-8 text-gray-300 mx-auto" />
                      <p className="text-xs font-semibold text-gray-700">No members found</p>
                      <p className="text-[11px] text-gray-400">
                        {search
                          ? 'No community members match your search criteria.'
                          : 'No members have been added to this community yet. Use "+ Add User" to add the first member.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {pagination.total_pages > 1 && (
          <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div>
              Showing <span className="font-semibold text-gray-800">{startRank}</span> to{' '}
              <span className="font-semibold text-gray-800">
                {Math.min(startRank + users.length - 1, pagination.total)}
              </span>{' '}
              of <span className="font-semibold text-gray-800">{pagination.total}</span> members
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 font-medium">
                {page} / {pagination.total_pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={page >= pagination.total_pages}
                className="px-2.5 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal Pre-Scoped to Community */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          triggerRefresh()
          setStatusMessage('User added successfully to community!')
          setTimeout(() => setStatusMessage(null), 4000)
        }}
        communitySlug={slug}
        communityName={community?.name}
      />

      {/* Confirmation Modal for Remove Member from Community */}
      <ConfirmModal
        isOpen={!!userToRemove}
        title="Remove Member from Community"
        message={`Are you sure you want to remove '${userToRemove?.display_name || userToRemove?.leetcode_username}' from ${community?.name || slug}? Their profile will remain on the platform and other communities they belong to will not be affected.`}
        confirmLabel="Remove from Community"
        isDestructive={true}
        isLoading={isRemoving}
        onConfirm={handleRemoveConfirm}
        onClose={() => setUserToRemove(null)}
      />
    </div>
  )
}
