import { useState, type FormEvent } from 'react'
import { useAdminAuth } from '@/context/AdminAuthContext'
import { useRouter } from '@/context/RouterContext'
import { TrophyIcon, SpinnerIcon, AlertTriangleIcon } from '@/components/icons/Icons'

export function AdminLogin() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { login } = useAdminAuth()
  const { navigate } = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || !password) {
      setError('Invalid credentials.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await login(identifier.trim(), password)
      navigate('/admin/users')
    } catch {
      // Generic error per security specification: never reveal username/password specificity
      setError('Invalid credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFA116] to-[#F89F1B] flex items-center justify-center text-white shadow-xs">
            <TrophyIcon className="w-6 h-6 text-white" />
          </div>
        </div>

        <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-gray-900">
          LeetCode Leaderboard
        </h1>
        <p className="mt-1 text-center text-xs font-semibold text-amber-600 tracking-wider uppercase">
          Administrative Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xs border border-gray-200 rounded-xl sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2.5 text-xs font-medium text-rose-700">
                <AlertTriangleIcon className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="admin-identifier"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Username or Email
              </label>
              <input
                id="admin-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F89F1B] focus:border-transparent transition-all"
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F89F1B] focus:border-transparent transition-all"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-xs text-sm font-semibold text-white bg-[#F89F1B] hover:bg-[#D97706] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F89F1B] transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isLoading && <SpinnerIcon className="w-4 h-4 text-white" />}
                <span>{isLoading ? 'Authenticating...' : 'Log In'}</span>
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <span className="text-xs text-gray-400">
              Authorized personnel only. Access attempts are monitored and rate limited.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

