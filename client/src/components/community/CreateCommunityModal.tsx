import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/shared/Modal'
import { CheckCircleIcon, SpinnerIcon, AlertTriangleIcon } from '@/components/icons/Icons'
import { submitCommunityRequest } from '@/services/api'

interface CreateCommunityModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CreateCommunityModal({ isOpen, onClose, onSuccess }: CreateCommunityModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [requesterName, setRequesterName] = useState('')
  const [requesterEmail, setRequesterEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  function handleReset() {
    setName('')
    setDescription('')
    setRequesterName('')
    setRequesterEmail('')
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
    setErrorMessage(null)

    const trimmedName = name.trim()
    const trimmedDesc = description.trim()
    const trimmedRequesterName = requesterName.trim()
    const trimmedRequesterEmail = requesterEmail.trim()

    if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 100) {
      setErrorMessage('Community name must be between 3 and 100 characters.')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await submitCommunityRequest({
        name: trimmedName,
        description: trimmedDesc || undefined,
        requester_name: trimmedRequesterName || undefined,
        requester_email: trimmedRequesterEmail || undefined,
      })

      setIsSuccess(true)
      setSuccessMessage(
        res.message ||
          'Your community creation request has been submitted for administrative review. Once approved, the community leaderboard will become publicly available.'
      )
      onSuccess?.()
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to submit community creation request.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isSuccess ? 'Community Request Submitted' : 'Request a New Community'}
    >
      {isSuccess ? (
        <div className="py-2 space-y-4 text-center">
          <div className="flex justify-center text-emerald-500">
            <CheckCircleIcon className="w-12 h-12" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-gray-900">Request Pending Review</h3>
            <p className="text-sm text-gray-600 leading-relaxed px-2">{successMessage}</p>
          </div>
          <div className="pt-3">
            <button
              type="button"
              onClick={handleClose}
              className="w-full inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-white bg-[#F89F1B] hover:bg-[#D97706] rounded-md transition-colors shadow-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-gray-500">
            Establish a dedicated competitive programming leaderboard for your college, company, or study circle.
          </p>

          {errorMessage && (
            <div
              className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-start gap-2"
              role="alert"
            >
              <AlertTriangleIcon className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label htmlFor="community-name" className="block text-xs font-semibold text-gray-700 mb-1">
              Community Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="community-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. College Coding Club, Placement Prep 2026"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-[#F89F1B] focus:border-transparent transition-colors"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="community-desc" className="block text-xs font-semibold text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              id="community-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of your group or organization..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-[#F89F1B] focus:border-transparent transition-colors resize-none"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="requester-name" className="block text-xs font-semibold text-gray-700 mb-1">
                Your Name <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                id="requester-name"
                type="text"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="Organizer Name"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-[#F89F1B] focus:border-transparent transition-colors"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="requester-email" className="block text-xs font-semibold text-gray-700 mb-1">
                Contact Email <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                id="requester-email"
                type="email"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                placeholder="organizer@example.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-[#F89F1B] focus:border-transparent transition-colors"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-xs hover:bg-gray-50 focus:outline-none transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F89F1B] hover:bg-[#D97706] rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <SpinnerIcon className="w-4 h-4 animate-spin text-white" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Request</span>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
