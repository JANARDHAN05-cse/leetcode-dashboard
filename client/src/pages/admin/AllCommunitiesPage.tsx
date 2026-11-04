import { useState, useEffect } from 'react'
import type { Community } from '@/types'
import type { RefreshJobStatus } from '@/types/admin'
import { adminApi, AdminApiError } from '@/services/admin-api'
import { useRouter } from '@/context/RouterContext'
import { CreateCommunityModal } from '@/components/community/CreateCommunityModal'
import {
  RefreshCwIcon,
  PlusIcon,
  UsersIcon,
  ExternalLinkIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from '@/components/icons/Icons'

export function AllCommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Platform-wide bulk refresh state
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)
  const [globalJob, setGlobalJob] = useState<RefreshJobStatus | null>(null)
  const [globalSummary, setGlobalSummary] = useState<{
    totalCommunities?: number
    total: number
    successful: number
    failed: number
  } | null>(null)

  // Per-community refresh state (communityId -> boolean)
  const [refreshingCommunityId, setRefreshingCommunityId] = useState<number | null>(null)
  const [communityNotice, setCommunityNotice] = useState<{ id: number; message: string; isError?: boolean } | null>(null)

  // Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const { navigate } = useRouter()

  const triggerRefresh = () => {
    setIsLoading(true)
    setRefreshTrigger((prev) => prev + 1)
  }

  // Load communities
  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const list = await adminApi.getAdminCommunities()
        if (isMounted) {
          setCommunities(list)
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

    load()

    return () => {
      isMounted = false
    }
  }, [refreshTrigger])

  // Check on mount if a global refresh is already running
  useEffect(() => {
    let isMounted = true

    adminApi
      .getRefreshAllCommunitiesStatus()
      .then((status) => {
        if (!isMounted) return
        if (status.status === 'running') {
          setIsRefreshingAll(true)
          setGlobalJob(status)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [])

  // Poll progress while platform-wide bulk refresh is active
  useEffect(() => {
    if (!isRefreshingAll) return

    let isMounted = true
    const interval = setInterval(async () => {
      try {
        const status = await adminApi.getRefreshAllCommunitiesStatus()
        if (!isMounted) return
        setGlobalJob(status)

        if (status.status === 'completed' || status.status === 'failed') {
          setIsRefreshingAll(false)
          setGlobalSummary({
            totalCommunities: status.totalCommunities,
            total: status.total,
            successful: status.successful,
            failed: status.failed,
          })
          triggerRefresh()
        }
      } catch {
        // Continue polling
      }
    }, 1000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [isRefreshingAll])

  // Platform Admin: Refresh All Communities
  const handleRefreshAllCommunities = async () => {
    if (isRefreshingAll) return
    setGlobalSummary(null)

    try {
      const initialJob = await adminApi.refreshAllCommunities()
      setGlobalJob(initialJob)
      setIsRefreshingAll(true)

      if (initialJob.status === 'completed') {
        setIsRefreshingAll(false)
        setGlobalSummary({
          totalCommunities: initialJob.totalCommunities,
          total: initialJob.total,
          successful: initialJob.successful,
          failed: initialJob.failed,
        })
        triggerRefresh()
      }
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 'REFRESH_IN_PROGRESS') {
        setIsRefreshingAll(true)
      } else {
        alert(err instanceof AdminApiError ? err.message : 'Failed to start platform refresh.')
      }
    }
  }

  // Refresh single community
  const handleRefreshCommunity = async (comm: Community) => {
    if (refreshingCommunityId === comm.id || isRefreshingAll) return
    setRefreshingCommunityId(comm.id)
    setCommunityNotice(null)

    try {
      await adminApi.refreshCommunity(comm.slug)
      setCommunityNotice({
        id: comm.id,
        message: `Refreshed member statistics for '${comm.name}'.`,
      })
      triggerRefresh()
      setTimeout(() => setCommunityNotice(null), 5000)
    } catch (err: unknown) {
      setCommunityNotice({
        id: comm.id,
        message: err instanceof Error ? err.message : 'Failed to refresh community.',
        isError: true,
      })
      setTimeout(() => setCommunityNotice(null), 5000)
    } finally {
      setRefreshingCommunityId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">All Communities</h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage multi-community leaderboards, member counts, and platform-wide synchronization.
          </p>
        </div>

        {/* Top-Right Actions: Refresh All Communities beside Request Community */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleRefreshAllCommunities}
            disabled={isRefreshingAll}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            title="Refresh statistics for all approved communities and their members"
          >
            <RefreshCwIcon
              className={`w-3.5 h-3.5 text-gray-500 ${isRefreshingAll ? 'animate-spin text-[#F89F1B]' : ''}`}
            />
            <span>{isRefreshingAll ? 'Refreshing...' : 'Refresh All Communities'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F89F1B] hover:bg-[#D97706] rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <PlusIcon className="w-4 h-4 text-white" />
            <span>Add Community</span>
          </button>
        </div>
      </div>

      {/* 2. Platform Bulk Refresh Progress Banner */}
      {globalJob && isRefreshingAll && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <RefreshCwIcon className="w-4 h-4 text-[#F89F1B] animate-spin shrink-0" />
            <span className="font-medium">
              Refreshing {globalJob.processed} of {globalJob.total} profiles across{' '}
              {globalJob.totalCommunities ?? 'all'} communities
              {globalJob.currentUser ? (
                <span className="font-mono text-gray-700 ml-1">({globalJob.currentUser})</span>
              ) : null}
              ...
            </span>
          </div>
          <div className="text-xs text-amber-800 font-medium">
            <span className="text-emerald-700 font-semibold">{globalJob.successful} updated</span>
            {globalJob.failed > 0 && (
              <span className="text-rose-600 font-semibold ml-2">{globalJob.failed} failed</span>
            )}
          </div>
        </div>
      )}

      {/* 3. Platform Bulk Refresh Summary Banner */}
      {globalSummary && (
        <div
          className={`p-3.5 rounded-md text-xs border flex items-center justify-between shadow-xs ${
            globalSummary.failed > 0
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Platform refresh completed: <strong>{globalSummary.successful}</strong> profiles updated,{' '}
              <strong>{globalSummary.failed}</strong> failed across{' '}
              <strong>{globalSummary.totalCommunities ?? 'all'}</strong> communities.
              {globalSummary.failed > 0 && (
                <span className="ml-1 text-gray-600">
                  (Previous statistics preserved for failed profiles; retry individually below)
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setGlobalSummary(null)}
            className="text-xs font-semibold underline hover:opacity-80 cursor-pointer ml-3 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Community Specific Notice */}
      {communityNotice && (
        <div
          className={`p-3 rounded-md text-xs border flex items-center gap-2 ${
            communityNotice.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {communityNotice.isError ? (
            <AlertTriangleIcon className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{communityNotice.message}</span>
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

      {/* 4. Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" role="table">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th scope="col" className="px-4 py-3">Community</th>
                <th scope="col" className="px-4 py-3">Slug</th>
                <th scope="col" className="px-4 py-3">Members</th>
                <th scope="col" className="px-4 py-3">Owner</th>
                <th scope="col" className="px-4 py-3">Sync Settings</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                    </td>
                  </tr>
                ))
              ) : communities.length > 0 ? (
                communities.map((comm) => (
                  <tr key={comm.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Name & Desc */}
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-gray-900">{comm.name}</div>
                      {comm.description && (
                        <div className="text-[11px] text-gray-500 line-clamp-1 max-w-xs mt-0.5">
                          {comm.description}
                        </div>
                      )}
                    </td>

                    {/* Slug */}
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">
                      /{comm.slug}
                    </td>

                    {/* Members */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-800 bg-gray-100 px-2.5 py-0.5 rounded-full">
                        <UsersIcon className="w-3 h-3 text-gray-500" />
                        <span>{comm.member_count ?? 0}</span>
                      </span>
                    </td>

                    {/* Owner */}
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {comm.owner_username || 'Platform'}
                    </td>

                    {/* Sync Settings */}
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      Every {comm.refresh_interval_hours ?? 6}h • Conc: {comm.refresh_concurrency ?? 3}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          comm.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {comm.status}
                      </span>
                    </td>

                    {/* Row Actions: Refresh Community + Manage Members + Public Leaderboard */}
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Refresh Community */}
                        <button
                          type="button"
                          onClick={() => handleRefreshCommunity(comm)}
                          disabled={refreshingCommunityId === comm.id || isRefreshingAll}
                          title={`Refresh member statistics for ${comm.name}`}
                          className="p-1.5 text-gray-500 hover:text-[#F89F1B] hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <RefreshCwIcon
                            className={`w-3.5 h-3.5 ${
                              refreshingCommunityId === comm.id ? 'animate-spin text-[#F89F1B]' : ''
                            }`}
                          />
                        </button>

                        {/* Manage Members */}
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/communities/${comm.slug}/members`)}
                          title={`Manage members in ${comm.name}`}
                          className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 border border-gray-200 rounded transition-colors cursor-pointer"
                        >
                          Manage Members
                        </button>

                        {/* Open Public Community */}
                        <button
                          type="button"
                          onClick={() => navigate(`/communities/${comm.slug}`)}
                          title="Open public community leaderboard"
                          className="inline-flex items-center gap-1 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                        >
                          <ExternalLinkIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-xs text-gray-500">
                    No communities found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Community */}
      <CreateCommunityModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={triggerRefresh}
      />
    </div>
  )
}
