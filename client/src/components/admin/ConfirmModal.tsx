import { XIcon, AlertTriangleIcon, SpinnerIcon } from '@/components/icons/Icons'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  isDestructive?: boolean
  isLoading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            {isDestructive && (
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangleIcon className="w-5 h-5 text-rose-600" />
              </div>
            )}
            <div className="flex-1">
              <h3 id="confirm-modal-title" className="text-base font-semibold text-gray-900 mb-1">
                {title}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {message}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 rounded-md p-1 transition-colors -mr-2 -mt-2"
              aria-label="Close"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-md transition-colors disabled:opacity-50 ${
                isDestructive
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-[#F89F1B] hover:bg-[#D97706]'
              }`}
            >
              {isLoading && <SpinnerIcon className="w-3.5 h-3.5" />}
              <span>{confirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

