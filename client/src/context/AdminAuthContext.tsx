/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { AdminUser } from '@/types/admin'
import { adminApi } from '@/services/admin-api'

interface AdminAuthContextType {
  admin: AdminUser | null
  isAuthenticated: boolean
  isLoading: boolean
  pendingCount: number
  communityRequestsCount: number
  refreshPendingCount: () => Promise<void>
  refreshCommunityRequestsCount: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [communityRequestsCount, setCommunityRequestsCount] = useState(0)

  const refreshPendingCount = useCallback(async () => {
    try {
      const res = await adminApi.getPendingRequestsCount()
      setPendingCount(res.count)
    } catch {
      // If unauthenticated or network error, ignore count update
    }
  }, [])

  const refreshCommunityRequestsCount = useCallback(async () => {
    try {
      const res = await adminApi.getCommunityRequests('pending')
      setCommunityRequestsCount(res.length)
    } catch {
      // Ignore
    }
  }, [])

  // Check existing session on mount
  useEffect(() => {
    let isMounted = true

    async function checkSession() {
      try {
        const res = await adminApi.getMe()
        if (isMounted) {
          setAdmin(res.admin)
          // Fetch initial counts
          try {
            const countRes = await adminApi.getPendingRequestsCount()
            if (isMounted) setPendingCount(countRes.count)
          } catch {
            // Ignore initial pending count failure
          }
          try {
            const commRes = await adminApi.getCommunityRequests('pending')
            if (isMounted) setCommunityRequestsCount(commRes.length)
          } catch {
            // Ignore initial community count failure
          }
        }
      } catch {
        if (isMounted) {
          setAdmin(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    checkSession()

    return () => {
      isMounted = false
    }
  }, [])

  const login = async (username: string, password: string) => {
    const res = await adminApi.login(username, password)
    setAdmin(res.admin)
    await refreshPendingCount()
    await refreshCommunityRequestsCount()
  }

  const logout = async () => {
    try {
      await adminApi.logout()
    } finally {
      setAdmin(null)
      setPendingCount(0)
      setCommunityRequestsCount(0)
    }
  }

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        isLoading,
        pendingCount,
        communityRequestsCount,
        refreshPendingCount,
        refreshCommunityRequestsCount,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}
