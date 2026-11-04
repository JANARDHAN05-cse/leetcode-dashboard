import { useEffect, type ReactNode } from 'react'
import { useAdminAuth } from '@/context/AdminAuthContext'
import { useRouter } from '@/context/RouterContext'
import { SpinnerIcon } from '@/components/icons/Icons'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAdminAuth()
  const { navigate } = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/admin/login')
    }
  }, [isLoading, isAuthenticated, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <SpinnerIcon className="w-8 h-8 text-[#F89F1B]" />
          <p className="text-sm font-medium text-gray-500">Checking authorization...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}

