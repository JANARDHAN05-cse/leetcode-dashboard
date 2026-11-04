import { useState, useEffect, type FormEvent } from 'react'
import { adminApi, AdminApiError } from '@/services/admin-api'
import { XIcon, SpinnerIcon } from '@/components/icons/Icons'
import type { Community } from '@/types'

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  communitySlug?: string
  communityName?: string
}

export function AddUserModal({
  isOpen,
  onClose,
  onSuccess,
  communitySlug,
  communityName,
}: AddUserModalProps) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [selectedSlug, setSelectedSlug] = useState(communitySlug || 'joyboys')
  const [communities, setCommunities] = useState<Community[]>([])
  const [loadingCommunities, setLoadingCommunities] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch communities if no specific communitySlug is provided
  useEffect(() => {
    if (!isOpen || communitySlug) return

    let isMounted = true
    adminApi
      .getAdminCommunities()
      .then((data) => {
        if (isMounted) {
          setCommunities(data)
          if (data.length > 0) {
            const defaultComm = data.find((c) => c.slug === 'joyboys') || data[0]
            setSelectedSlug(defaultComm.slug)
          }
          setLoadingCommunities(false)
        }
      })
      .catch(() => {
        if (isMounted) setLoadingCommunities(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, communitySlug])

  if (!isOpen) return null

  const targetSlug = communitySlug || selectedSlug

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const cleanUsername = username.trim()
    if (!cleanUsername) {
      setError('LeetCode username is required.')
      return
    }

    if (!targetSlug) {
      setError('Please select a target community.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await adminApi.addCommunityMember(targetSlug, {
        leetcode_username: cleanUsername,
        display_name: displayName.trim() || undefined,
      })
      setUsername('')
      setDisplayName('')
      onSuccess()
      onClose()
    } catch (err) {
      if (err instanceof AdminApiError) {
        setError(err.message)
      } else {
        setError('Failed to add user. Please check the username and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-modal-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id="add-user-modal-title" className="text-base font-semibold text-gray-900">
            {communityName ? `Add Member to ${communityName}` : 'Add Approved Member'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-md p-1 transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-gray-500">
            Enter a LeetCode username. The system will query LeetCode to fetch live statistics and add the member to the community leaderboard.
          </p>

          {/* Community indicator or selector */}
          {communitySlug ? (
            <div className="p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-md flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">Target Community:</span>
              <span className="font-semibold text-amber-900">
                {communityName || communitySlug} <span className="font-mono text-amber-700">({communitySlug})</span>
              </span>
            </div>
          ) : (
            <div>
              <label htmlFor="target-community-select" className="block text-xs font-semibold text-gray-700 mb-1">
                Target Community <span className="text-rose-500">*</span>
              </label>
              {loadingCommunities ? (
                <div className="text-xs text-gray-400 py-1">Loading communities...</div>
              ) : (
                <select
                  id="target-community-select"
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#F89F1B] focus:border-transparent"
                >
                  {communities.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name} (/{c.slug})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="add-username" className="block text-xs font-semibold text-gray-700 mb-1">
              LeetCode Username <span className="text-rose-500">*</span>
            </label>
            <input
              id="add-username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. touristholder"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F89F1B] focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="add-displayname" className="block text-xs font-semibold text-gray-700 mb-1">
              Display Name <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              id="add-displayname"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Wice"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F89F1B] focus:border-transparent"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F89F1B] hover:bg-[#D97706] rounded-md transition-colors disabled:opacity-50"
            >
              {isSubmitting && <SpinnerIcon className="w-3.5 h-3.5" />}
              <span>{isSubmitting ? 'Validating Profile...' : 'Add User'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
