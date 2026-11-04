import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/shared/Modal'
import { CheckCircleIcon, SpinnerIcon, AlertTriangleIcon } from '@/components/icons/Icons'
import { submitJoinRequest, submitCommunityMemberRequest, validateLeetCodeUser } from '@/services/api'

interface RequestModalProps {
  isOpen: boolean
  onClose: () => void
  communitySlug?: string
  communityName?: string
}

export function RequestModal({ isOpen, onClose, communitySlug, communityName }: RequestModalProps) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inlineValidationError, setInlineValidationError] = useState<string | null>(null)
  const [providerWarning, setProviderWarning] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  function handleReset() {
    setUsername('')
    setDisplayName('')
    setInlineValidationError(null)
    setProviderWarning(null)
    setErrorMessage(null)
    setIsSuccess(false)
    setSuccessMessage('')
    setIsSubmitting(false)
  }

  function handleClose() {
    handleReset()
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setInlineValidationError(null)
    setProviderWarning(null)
    setErrorMessage(null)

    const trimmedUsername = username.trim()
    const trimmedDisplayName = displayName.trim()

    // 1. Format validation
    if (!trimmedUsername) {
      setInlineValidationError('LeetCode username is required.')
      return
    }

    const usernameRegex = /^[a-zA-Z0-9_-]{1,30}$/
    if (!usernameRegex.test(trimmedUsername)) {
      setInlineValidationError(
        'Username must be between 1 and 30 characters and only contain letters, numbers, underscores, or hyphens.'
      )
      return
    }

    if (trimmedDisplayName.length > 60) {
      setErrorMessage('Display name cannot exceed 60 characters.')
      return
    }

    try {
      setIsSubmitting(true)

      // 2. Pre-submission live profile validation against real LeetCode API
      const check = await validateLeetCodeUser(trimmedUsername)
      if (!check.valid) {
        if (check.reason === 'not_found') {
          setInlineValidationError(`LeetCode profile '${trimmedUsername}' does not exist.`)
          return
        } else {
          setProviderWarning(
            check.message || 'LeetCode service is temporarily unavailable. Please try again shortly.'
          )
          return
        }
      }

      // 3. Submit request to community or default
      let resMessage = ''
      if (communitySlug) {
        const res = await submitCommunityMemberRequest(communitySlug, {
          leetcode_username: trimmedUsername,
          display_name: trimmedDisplayName || undefined,
        })
        resMessage = res.message
      } else {
        const res = await submitJoinRequest({
          leetcode_username: trimmedUsername,
          display_name: trimmedDisplayName || undefined,
        })
        resMessage = res.message
      }

      setIsSuccess(true)
      setSuccessMessage(resMessage)
    } catch (err: unknown) {
      if (err instanceof Error) {
        const errorWithCode = err as Error & { code?: string }
        // Distinguish nonexistent profile from other errors
        if (errorWithCode.code === 'PROFILE_NOT_FOUND' || err.message.includes('does not exist')) {
          setInlineValidationError(err.message)
        } else if (errorWithCode.code === 'PROVIDER_UNAVAILABLE') {
          setProviderWarning(err.message)
        } else {
          setErrorMessage(err.message)
        }
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isSuccess ? 'Request Submitted' : `Request to Join ${communityName || 'Leaderboard'}`}
    >
      {isSuccess ? (
        <div className="py-2 space-y-4 text-center">
          <div className="flex justify-center text-emerald-500">
            <CheckCircleIcon className="w-12 h-12" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-gray-900">
              Submission Successful
            </h3>
            {/* LOCKED EXACT CONFIRMATION TEXT */}
            <p className="text-sm text-gray-600 leading-relaxed px-2">
              {successMessage}
            </p>
          </div>
          <div className="pt-3">
            <button
              type="button"
              onClick={handleClose}
              className="w-full inline-flex justify-center items-center px-4 py-2 text-sm font-semibold text-white bg-[#F89F1B] hover:bg-[#D97706] rounded-md transition-colors shadow-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-gray-500">
            Submit your public LeetCode handle. Once approved by {communityName ? 'the community owner' : 'an administrator'}, your stats will appear on the leaderboard.
          </p>

          {errorMessage && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 flex items-start gap-2 text-rose-800 text-xs">
              <AlertTriangleIcon className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="leetcode-username"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              LeetCode Username <span className="text-rose-500">*</span>
            </label>
            <input
              id="leetcode-username"
              type="text"
              required
              maxLength={30}
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setInlineValidationError(null)
                setProviderWarning(null)
              }}
              placeholder="e.g. johndoe"
              className={`block w-full px-3 py-2 border rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 font-mono ${
                inlineValidationError
                  ? 'border-rose-400 focus:ring-rose-400 focus:border-rose-400 bg-rose-50/20'
                  : 'border-gray-300 focus:ring-[#F89F1B] focus:border-[#F89F1B]'
              }`}
              disabled={isSubmitting}
            />

            {/* ACCESSIBLE INLINE VALIDATION MESSAGES (NO JAVASCRIPT ALERT) */}
            {inlineValidationError && (
              <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1 font-medium">
                <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>{inlineValidationError}</span>
              </p>
            )}

            {providerWarning && (
              <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1 font-medium bg-amber-50 p-2 rounded border border-amber-200">
                <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{providerWarning}</span>
              </p>
            )}

            <span className="text-[11px] text-gray-400 mt-1 block">
              1–30 characters: letters, numbers, hyphens, and underscores.
            </span>
          </div>

          <div>
            <label
              htmlFor="display-name"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Display Name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="display-name"
              type="text"
              maxLength={60}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. John Doe"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#F89F1B] focus:border-[#F89F1B]"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#F89F1B] hover:bg-[#D97706] disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors shadow-xs cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <SpinnerIcon className="w-4 h-4 mr-2 animate-spin text-white" />
                  Submitting…
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
