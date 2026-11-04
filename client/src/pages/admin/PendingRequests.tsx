import { useState, useEffect } from 'react'
import type { PendingRequest, PaginationMeta } from '@/types/admin'
import type { Community } from '@/types'
import { adminApi, AdminApiError } from '@/services/admin-api'
import { useAdminAuth } from '@/context/AdminAuthContext'
import {
  ExternalLinkIcon,
  SpinnerIcon,
  CheckCircleIcon,
} from '@/components/icons/Icons'

export function PendingRequests() {
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    total_pages: 1,
  })
  const [page, setPage] = useState(1)
  const [selectedCommunitySlug, setSelectedCommunitySlug] = useState<string>('')
  const [communities, setCommunities] = useState<Community[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Track processing action per row: { [id]: 'approving' | 'rejecting' }
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [processingAction, setProcessingAction] = useState<'approving' | 'rejecting' | null>(null)

  // Rejection modal state
  const [rejectingRequest, setRejectingRequest] = useState<PendingRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const { refreshPendingCount } = useAdminAuth()

  // Load available communities for filter
  useEffect(() => {
    adminApi
      .getAdminCommunities()
      .then((data) => setCommunities(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadRequests() {
      try {
        const data = await adminApi.getPendingRequests({
          page,
          limit: 25,
          community_slug: selectedCommunitySlug || undefined,
        })
        if (isMounted) {
          setRequests(data.requests)
          setPagination(data.pagination)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch member requests.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadRequests()

    return () => {
      isMounted = false
    }
  }, [page, selectedCommunitySlug, refreshTrigger])

  const triggerRefresh = () => {
    setIsLoading(true)
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleApprove = async (req: PendingRequest) => {
    setProcessingId(req.id)
    setProcessingAction('approving')
    try {
      await adminApi.approveRequest(req.id)
      setStatusMessage(`Approved profile '${req.leetcode_username}'. Live stats fetched and member added.`)
      setTimeout(() => setStatusMessage(null), 5000)
      await refreshPendingCount()
      triggerRefresh()
    } catch (err) {
      setStatusMessage(err instanceof AdminApiError ? err.message : 'Approval failed.')
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setProcessingId(null)
      setProcessingAction(null)
    }
  }

  const handleConfirmReject = async () => {
    if (!rejectingRequest) return
    const req = rejectingRequest
    setProcessingId(req.id)
    setProcessingAction('rejecting')

    try {
      await adminApi.rejectRequest(req.id, rejectionReason.trim() || undefined)
      setStatusMessage(`Rejected request for '${req.leetcode_username}'.`)
      setTimeout(() => setStatusMessage(null), 4000)
      setRejectingRequest(null)
      setRejectionReason('')
      await refreshPendingCount()
      triggerRefresh()
    } catch (err) {
      setStatusMessage(err instanceof AdminApiError ? err.message : 'Rejection failed.')
      setTimeout(() => setStatusMessage(null), 5000)
    } finally {
      setProcessingId(null)
      setProcessingAction(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Member Requests</h1>
          <p className="text-xs text-gray-500 mt-1">
            Review and approve requests from visitors wishing to join a community leaderboard. Approving validates the profile and adds them to the community.
          </p>
        </div>

        {/* Community Filter */}
        {communities.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <label htmlFor="comm-filter" className="text-xs font-medium text-gray-600 whitespace-nowrap">
              Community:
            </label>
            <select
              id="comm-filter"
              value={selectedCommunitySlug}
              onChange={(e) => {
                setSelectedCommunitySlug(e.target.value)
                setPage(1)
              }}
              className="text-xs bg-white border border-gray-300 rounded-md px-2.5 py-1.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F89F1B]"
            >
              <option value="">All Communities</option>
              {communities.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

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

      {/* 2. Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" role="table">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th scope="col" className="px-5 py-3">LeetCode Username</th>
                <th scope="col" className="px-5 py-3">Display Name</th>
                <th scope="col" className="px-5 py-3">Community</th>
                <th scope="col" className="px-5 py-3">Requested At</th>
                <th scope="col" className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="border-b border-gray-100 animate-pulse">
                    <td className="px-5 py-3.5"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
                    <td className="px-5 py-3.5"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
                    <td className="px-5 py-3.5"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
                    <td className="px-5 py-3.5"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
                    <td className="px-5 py-3.5 text-right"><div className="h-4 w-16 bg-gray-200 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : requests.length > 0 ? (
                requests.map((req) => {
                  const isRowProcessing = processingId === req.id
                  return (
                    <tr key={req.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Username */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <a
                          href={`https://leetcode.com/${encodeURIComponent(req.leetcode_username)}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-gray-900 hover:text-[#F89F1B] transition-colors font-mono inline-flex items-center gap-1 group"
                        >
                          <span>{req.leetcode_username}</span>
                          <ExternalLinkIcon className="opacity-0 group-hover:opacity-100 text-gray-400 w-3 h-3 transition-opacity" />
                        </a>
                      </td>

                      {/* Display Name */}
                      <td className="px-5 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                        {req.display_name || <span className="text-gray-400">—</span>}
                      </td>

                      {/* Community */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="font-semibold">{req.community_name || 'JoyBoys'}</span>
                          <span className="text-[10px] text-amber-600 font-mono">/{req.community_slug || 'joyboys'}</span>
                        </span>
                      </td>

                      {/* Requested At */}
                      <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(req.requested_at).toLocaleString()}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {/* Approve (green button) */}
                          <button
                            type="button"
                            onClick={() => handleApprove(req)}
                            disabled={isRowProcessing}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {isRowProcessing && processingAction === 'approving' && (
                              <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                            )}
                            <span>{isRowProcessing && processingAction === 'approving' ? 'Fetching...' : 'Approve'}</span>
                          </button>

                          {/* Reject (red/neutral button) */}
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingRequest(req)
                              setRejectionReason('')
                            }}
                            disabled={isRowProcessing}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-rose-50 hover:text-rose-700 rounded transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-xs text-gray-500">
                    No pending member requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 3. Pagination Footer */}
        {pagination.total_pages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
            <div>
              Showing page <span className="font-semibold text-gray-700">{page}</span> of{' '}
              <span className="font-semibold text-gray-700">{pagination.total_pages}</span> (
              {pagination.total} total requests)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={page >= pagination.total_pages}
                className="px-3 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <h2 className="text-base font-semibold text-gray-900">
              Reject Member Request
            </h2>
            <p className="text-xs text-gray-500">
              Are you sure you want to reject the request for{' '}
              <strong className="text-gray-800">{rejectingRequest.leetcode_username}</strong> to join{' '}
              <strong className="text-gray-800">{rejectingRequest.community_name || 'JoyBoys'}</strong>?
            </p>

            <div>
              <label htmlFor="rejection-reason" className="block text-xs font-semibold text-gray-700 mb-1">
                Reason for Rejection <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                id="rejection-reason"
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Duplicate account, incorrect profile, etc."
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F89F1B]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectingRequest(null)}
                disabled={processingId !== null}
                className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={processingId !== null}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {processingId === rejectingRequest.id ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
