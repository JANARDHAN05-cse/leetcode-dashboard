import { useState, useEffect, type FormEvent } from 'react'
import { adminApi, AdminApiError } from '@/services/admin-api'
import { useAdminAuth } from '@/context/AdminAuthContext'
import { useRouter } from '@/context/RouterContext'
import { SpinnerIcon, RefreshCwIcon, LogOutIcon } from '@/components/icons/Icons'

export function SettingsPage() {
  // Settings State
  const [intervalHours, setIntervalHours] = useState(6)
  const [concurrency, setConcurrency] = useState(3)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // Password State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const { logout } = useAdminAuth()
  const { navigate } = useRouter()

  useEffect(() => {
    async function loadSettings() {
      try {
        const s = await adminApi.getSettings()
        setIntervalHours(s.refresh_interval_hours)
        setConcurrency(s.refresh_concurrency)
      } catch {
        // Fallback to defaults
      }
    }
    loadSettings()
  }, [])

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault()
    setIsSavingSettings(true)
    setSettingsNotice(null)
    setSettingsError(null)

    try {
      await adminApi.updateSettings({
        refresh_interval_hours: Number(intervalHours),
        refresh_concurrency: Number(concurrency),
      })
      setSettingsNotice('Configuration saved successfully.')
      setTimeout(() => setSettingsNotice(null), 4000)
    } catch (err) {
      setSettingsError(err instanceof AdminApiError ? err.message : 'Failed to save settings.')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleRefreshAll = async () => {
    if (!window.confirm('Trigger immediate full refresh of all approved users from LeetCode?')) {
      return
    }

    setIsRefreshingAll(true)
    setSettingsNotice(null)
    setSettingsError(null)

    try {
      const res = await adminApi.refreshAll()
      setSettingsNotice(`Full refresh initiated for ${res.total} users.`)
      setTimeout(() => setSettingsNotice(null), 5000)
    } catch (err) {
      setSettingsError(err instanceof AdminApiError ? err.message : 'Failed to trigger full refresh.')
    } finally {
      setIsRefreshingAll(false)
    }
  }

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordNotice(null)
    setPasswordError(null)

    if (!currentPassword) {
      setPasswordError('Current password is required.')
      return
    }

    if (newPassword.length < 12) {
      setPasswordError('New password must be at least 12 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setIsChangingPassword(true)

    try {
      await adminApi.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordNotice('Password updated successfully.')
      setTimeout(() => setPasswordNotice(null), 4000)
    } catch (err) {
      setPasswordError(err instanceof AdminApiError ? err.message : 'Failed to update password.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login')
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* 1. Header */}
      <div className="pb-2 border-b border-gray-200">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Settings</h1>
        <p className="text-xs text-gray-500 mt-1">
          Configure synchronization parameters, trigger on-demand refreshes, and manage administrative credentials.
        </p>
      </div>

      {/* 2. Refresh Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Background Synchronization</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Control the periodic statistics refresh worker and LeetCode query rate.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isRefreshingAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-md shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isRefreshingAll ? (
              <SpinnerIcon className="w-3.5 h-3.5" />
            ) : (
              <RefreshCwIcon className="w-3.5 h-3.5 text-gray-500" />
            )}
            <span>{isRefreshingAll ? 'Queueing...' : 'Refresh All Now'}</span>
          </button>
        </div>

        <form onSubmit={handleSaveSettings} className="p-6 space-y-4">
          {settingsNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-emerald-800">
              {settingsNotice}
            </div>
          )}
          {settingsError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs font-medium text-rose-700">
              {settingsError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="refresh-interval" className="block text-xs font-semibold text-gray-700 mb-1">
                Refresh Interval
              </label>
              <select
                id="refresh-interval"
                value={intervalHours}
                onChange={(e) => setIntervalHours(Number(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F89F1B]"
              >
                <option value={6}>Every 6 hours (Default)</option>
                <option value={12}>Every 12 hours</option>
                <option value={24}>Every 24 hours</option>
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                How frequently cached user statistics are re-verified with LeetCode.
              </p>
            </div>

            <div>
              <label htmlFor="concurrency-limit" className="block text-xs font-semibold text-gray-700 mb-1">
                Concurrency Limit
              </label>
              <select
                id="concurrency-limit"
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#F89F1B]"
              >
                <option value={1}>1 worker (Most conservative)</option>
                <option value={2}>2 concurrent workers</option>
                <option value={3}>3 concurrent workers (Default)</option>
                <option value={4}>4 concurrent workers</option>
                <option value={5}>5 concurrent workers (Maximum)</option>
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Maximum concurrent HTTP connections to prevent LeetCode rate limiting.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#F89F1B] hover:bg-[#D97706] rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSavingSettings && <SpinnerIcon className="w-3.5 h-3.5" />}
              <span>{isSavingSettings ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Account Management / Password Change */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Change Administrator Password</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Passwords must be at least 12 characters and will be securely hashed with bcrypt.
          </p>
        </div>

        <form onSubmit={handleChangePassword} className="p-6 space-y-4 max-w-md">
          {passwordNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-emerald-800">
              {passwordNotice}
            </div>
          )}
          {passwordError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs font-medium text-rose-700">
              {passwordError}
            </div>
          )}

          <div>
            <label htmlFor="current-pw" className="block text-xs font-semibold text-gray-700 mb-1">
              Current Password
            </label>
            <input
              id="current-pw"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F89F1B]"
            />
          </div>

          <div>
            <label htmlFor="new-pw" className="block text-xs font-semibold text-gray-700 mb-1">
              New Password (minimum 12 characters)
            </label>
            <input
              id="new-pw"
              type="password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F89F1B]"
            />
          </div>

          <div>
            <label htmlFor="confirm-pw" className="block text-xs font-semibold text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              id="confirm-pw"
              type="password"
              required
              minLength={12}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F89F1B]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#F89F1B] hover:bg-[#D97706] rounded-md transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isChangingPassword && <SpinnerIcon className="w-3.5 h-3.5" />}
              <span>{isChangingPassword ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. Session Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs p-6 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Current Session</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Log out to terminate the current administrative session.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors cursor-pointer"
        >
          <LogOutIcon className="w-4 h-4 text-rose-600" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  )
}

