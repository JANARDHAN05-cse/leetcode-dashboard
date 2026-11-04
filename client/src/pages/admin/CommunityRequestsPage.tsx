import { useState, useEffect } from 'react'
import type { CommunityCreationRequest } from '@/types/admin'
import { adminApi, AdminApiError } from '@/services/admin-api'
import { useAdminAuth } from '@/context/AdminAuthContext'
import {
  InboxIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  SpinnerIcon,
} from '@/components/icons/Icons'

export function CommunityRequestsPage() {
  const [requests, setRequests] = useState<CommunityCreationRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const { refreshCommunityRequestsCount } = useAdminAuth()

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        setIsLoading(true)
        const filter = statusFilter === 'all' ? undefined : statusFilter
        const list = await adminApi.getCommunityRequests(filter)
        if (isMounted) {
          setRequests(list)
          setError(null)
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load community requests.')
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
  }, [statusFilter, refreshTrigger])

  const triggerRefresh = () => {
    setIsLoading(true)
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleApprove = async (req: CommunityCreationRequest) => {
    if (!window.confirm(`Approve creation request for community '${req.name}'?`)) return
    setProcessingId(req.id)
    setActionNotice(null)

    try {
      await adminApi.approveCommunityRequest(req.id)
      setActionNotice(`Approved community '${req.name}'. It is now live in the directory.`)
      await refreshCommunityRequestsCount()
      triggerRefresh()
      setTimeout(() => setActionNotice(null), 5000)
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : 'Approval failed.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (req: CommunityCreationRequest) => {
    const reason = window.prompt(`Reason for rejecting '${req.name}' (optional):`)
    if (reason === null) return // user canceled prompt

    setProcessingId(req.id)
    setActionNotice(null)

    try {
      await adminApi.rejectCommunityRequest(req.id, reason || undefined)
      setActionNotice(`Rejected community request for '${req.name}'.`)
      await refreshCommunityRequestsCount()
      triggerRefresh()
      setTimeout(() => setActionNotice(null), 5000)
    } catch (err) {
      alert(err instanceof AdminApiError ? err.message : 'Rejection failed.')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Community Requests</h1>
          <p className="text-xs text-gray-500 mt-1">
            Review and approve public requests to establish new independent communities.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md self-start sm:self-auto text-xs">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded font-medium capitalize transition-colors cursor-pointer ${
                statusFilter === filter
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={triggerRefresh}
            className="text-xs font-semibold underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" role="table">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th scope="col" className="px-4 py-3">Community Name</th>
                <th scope="col" className="px-4 py-3">Slug</th>
                <th scope="col" className="px-4 py-3">Description</th>
                <th scope="col" className="px-4 py-3">Requester</th>
                <th scope="col" className="px-4 py-3">Date</th>
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
              ) : requests.length > 0 ? (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3 text-xs font-semibold text-gray-900 whitespace-nowrap">
                      {req.name}
                    </td>

                    {/* Slug */}
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">
                      /{req.slug}
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">
                      {req.description || <span className="text-gray-400">—</span>}
                    </td>

                    {/* Requester */}
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      <div>{req.requester_name || <span className="text-gray-400">Anonymous</span>}</div>
                      {req.requester_email && (
                        <div className="text-[10px] text-gray-400">{req.requester_email}</div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          req.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : req.status === 'rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {req.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(req)}
                            disabled={processingId === req.id}
                            className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {processingId === req.id ? (
                              <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              'Approve'
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReject(req)}
                            disabled={processingId === req.id}
                            className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-xs text-gray-500">
                    <InboxIcon className="w-6 h-6 mx-auto text-gray-300 mb-2" />
                    No community requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
