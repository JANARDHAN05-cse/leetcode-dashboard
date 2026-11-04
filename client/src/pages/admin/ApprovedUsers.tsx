import { useState, useEffect } from 'react'
import type { LeaderboardUser, PaginationMeta, RankingMetric } from '@/types'
import type { RefreshJobStatus } from '@/types/admin'
import { adminApi, AdminApiError } from '@/services/admin-api'
import { AddUserModal } from '@/components/admin/AddUserModal'
import { ConfirmModal } from '@/components/admin/ConfirmModal'
import { TableRowSkeleton } from '@/components/shared/Skeleton'
import {
  PlusIcon,
  SearchIcon,
  TrashIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
} from '@/components/icons/Icons'

export function ApprovedUsers() {
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

  // Batch Refresh State
  const [isBatchRefreshing, setIsBatchRefreshing] = useState(false)
  const [batchJob, setBatchJob] = useState<RefreshJobStatus | null>(null)
  const [batchSummary, setBatchSummary] = useState<{
    total: number
    successful: number
    failed: number
  } | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        const data = await adminApi.getApprovedUsers({
          sort: metric,
          search,
          page,
          limit,
        })
        if (isMounted) {
          setUsers(data.users)
          setPagination(data.pagination)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch approved users.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [metric, search, page, limit, refreshTrigger])

  const triggerRefresh = () => {
    setIsLoading(true)
    setRefreshTrigger((prev) => prev + 1)
  }

  // Check on initial mount if a batch refresh is actively running
  useEffect(() => {
    let isMounted = true

    adminApi
      .getRefreshAllStatus()
      .then((status) => {
        if (!isMounted) return
        if (status.status === 'running') {
          setIsBatchRefreshing(true)
          setBatchJob(status)
        }
      })
      .catch(() => {
        // Non-blocking diagnostic check
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Poll progress while batch refresh is active
  useEffect(() => {
    if (!isBatchRefreshing) return

    let isMounted = true
    const interval = setInterval(async () => {
      try {
        const status = await adminApi.getRefreshAllStatus()
        if (!isMounted) return
        setBatchJob(status)

        if (status.status === 'completed' || status.status === 'failed') {
          setIsBatchRefreshing(false)
          setBatchSummary({
            total: status.total,
            successful: status.successful,
            failed: status.failed,
          })
          setIsLoading(true)
          setRefreshTrigger((prev) => prev + 1)
        }
      } catch {
        // Transient network error; continue polling
      }
    }, 1000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [isBatchRefreshing])

  const handleRefreshAll = async () => {
    if (isBatchRefreshing) return
    setBatchSummary(null)
    setStatusMessage(null)

    try {
      const initialJob = await adminApi.startRefreshAll()
      setBatchJob(initialJob)
      setIsBatchRefreshing(true)

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
        setStatusMessage(err instanceof AdminApiError ? err.message : 'Failed to start refresh all.')
        setTimeout(() => setStatusMessage(null), 5000)
      }
    }
  }

  const handleRemoveConfirm = async () => {
    if (!userToRemove || isBatchRefreshing) return
    setIsRemoving(true)
    try {
      await adminApi.removeUser(userToRemove.id)
      setUserToRemove(null)
      triggerRefresh()
      setStatusMessage(`User '${userToRemove.leetcode_username}' has been removed.`)
      setTimeout(() => setStatusMessage(null), 4000)
    } catch (err) {
      setStatusMessage(err instanceof AdminApiError ? err.message : 'Failed to remove user.')
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setIsRemoving(false)
    }
  }

  const handleRefreshUser = async (user: LeaderboardUser) => {
    if (isBatchRefreshing) return
    setRefreshingUserId(user.id)
    try {
      await adminApi.refreshUser(user.id)
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
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Approved Users</h1>
          <p className="text-xs text-gray-500 mt-1">
            Active community members displayed on the public leaderboard. Manage, remove, or manually add profiles.
          </p>
        </div>

        {/* Header Actions: Refresh All beside Add User */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isBatchRefreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            title="Refresh statistics for all approved users from LeetCode"
          >
            <RefreshCwIcon
              className={`w-3.5 h-3.5 text-gray-500 ${isBatchRefreshing ? 'animate-spin text-[#F89F1B]' : ''}`}
            />
            <span>{isBatchRefreshing ? 'Refreshing...' : 'Refresh All'}</span>
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

      {/* Active Refresh Progress Banner */}
      {batchJob && isBatchRefreshing && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <RefreshCwIcon className="w-4 h-4 text-[#F89F1B] animate-spin shrink-0" />
            <span className="font-medium">
              Refreshing {batchJob.processed} of {batchJob.total} users
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

      {/* Completion Summary Banner */}
      {batchSummary && (
        <div
          className={`p-3.5 rounded-md text-xs border flex items-center justify-between shadow-xs ${
            batchSummary.failed > 0
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>
              Refresh completed: <strong>{batchSummary.successful}</strong> successful,{' '}
              <strong>{batchSummary.failed}</strong> failed out of {batchSummary.total} users.
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

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-emerald-800">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={triggerRefresh}
            className="text-xs font-semibold underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Controls & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search username or display name..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F89F1B] focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500">Sort by:</label>
          <select
            value={metric}
            onChange={(e) => {
              setMetric(e.target.value as RankingMetric)
              setPage(1)
            }}
            className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F89F1B]"
          >
            <option value="solved_total">Problems Solved</option>
            <option value="contest_rating">Contest Rating</option>
            <option value="contests_attended">Contests Attended</option>
          </select>
        </div>
      </div>

      {/* 3. Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" role="table">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 text-center sm:text-left w-12">#</th>
                <th scope="col" className="px-4 py-3">User</th>
                <th scope="col" className="px-4 py-3">Display Name</th>
                <th scope="col" className="px-4 py-3">Solved</th>
                <th scope="col" className="px-4 py-3">Rating</th>
                <th scope="col" className="px-4 py-3">Contests</th>
                <th scope="col" className="px-4 py-3">Last Refresh</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <TableRowSkeleton key={idx} columns={8} />
                ))
              ) : users.length > 0 ? (
                users.map((user, idx) => (
                  <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Rank */}
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 text-center sm:text-left">
                      {startRank + idx}
                    </td>

                    {/* Username & Avatar */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center border border-amber-200">
                            {user.leetcode_username.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <a
                          href={`https://leetcode.com/${encodeURIComponent(user.leetcode_username)}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-gray-900 hover:text-[#F89F1B] transition-colors font-mono inline-flex items-center gap-1 group"
                        >
                          <span>{user.leetcode_username}</span>
                          <ExternalLinkIcon className="opacity-0 group-hover:opacity-100 text-gray-400 w-3 h-3 transition-opacity" />
                        </a>
                      </div>
                    </td>

                    {/* Display Name */}
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {user.display_name || <span className="text-gray-400">—</span>}
                    </td>

                    {/* Solved Total */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-semibold text-gray-900">
                        {user.solved_total !== null ? user.solved_total.toLocaleString() : '—'}
                      </div>
                      {user.solved_total !== null && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                          <span className="text-emerald-600">{user.solved_easy ?? '—'}</span>
                          <span>/</span>
                          <span className="text-amber-600">{user.solved_medium ?? '—'}</span>
                          <span>/</span>
                          <span className="text-rose-600">{user.solved_hard ?? '—'}</span>
                        </div>
                      )}
                    </td>

                    {/* Contest Rating */}
                    <td className="px-4 py-3 text-xs font-medium text-gray-900 whitespace-nowrap">
                      {user.contest_rating !== null ? Math.round(user.contest_rating) : '—'}
                    </td>

                    {/* Contests Attended */}
                    <td className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap">
                      {user.contests_attended !== null ? user.contests_attended : '—'}
                    </td>

                    {/* Last Refresh */}
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {user.last_refreshed_at
                        ? new Date(user.last_refreshed_at).toLocaleDateString()
                        : '—'}
                    </td>

                    {/* Row Actions (CRITICAL: NO EDIT BUTTON) */}
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Quick Refresh (disabled during batch refresh to prevent conflict) */}
                        <button
                          type="button"
                          onClick={() => handleRefreshUser(user)}
                          disabled={isBatchRefreshing || refreshingUserId === user.id}
                          title={isBatchRefreshing ? 'Batch refresh in progress' : 'Refresh profile stats from LeetCode'}
                          className="p-1 text-gray-400 hover:text-[#F89F1B] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshCwIcon
                            className={`w-3.5 h-3.5 ${refreshingUserId === user.id ? 'animate-spin text-[#F89F1B]' : ''}`}
                          />
                        </button>

                        {/* Remove Action */}
                        <button
                          type="button"
                          onClick={() => setUserToRemove(user)}
                          disabled={isBatchRefreshing}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-xs text-gray-500">
                    No approved users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div>
              Showing <span className="font-semibold text-gray-800">{users.length}</span> of{' '}
              <span className="font-semibold text-gray-800">{pagination.total}</span> users
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page} of {pagination.total_pages}
              </span>
              <button
                type="button"
                disabled={page >= pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          triggerRefresh()
          setStatusMessage('User added successfully and synchronized.')
          setTimeout(() => setStatusMessage(null), 4000)
        }}
      />

      {/* Remove Confirmation Modal */}
      <ConfirmModal
        isOpen={!!userToRemove}
        title="Remove User"
        message={`Are you sure you want to remove '${userToRemove?.leetcode_username}'? This action cannot be undone.`}
        confirmLabel="Confirm Remove"
        isDestructive={true}
        isLoading={isRemoving}
        onConfirm={handleRemoveConfirm}
        onClose={() => setUserToRemove(null)}
      />
    </div>
  )
}
