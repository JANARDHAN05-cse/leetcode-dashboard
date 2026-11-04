import { RouterProvider, useRouter } from '@/context/RouterContext'
import { AdminAuthProvider } from '@/context/AdminAuthContext'
import { PublicLeaderboard } from '@/pages/PublicLeaderboard'
import { CommunityDirectory } from '@/pages/CommunityDirectory'
import { AdminLogin } from '@/pages/admin/AdminLogin'
import { AllCommunitiesPage } from '@/pages/admin/AllCommunitiesPage'
import { CommunityMembersPage } from '@/pages/admin/CommunityMembersPage'
import { CommunityRequestsPage } from '@/pages/admin/CommunityRequestsPage'
import { ApprovedUsers } from '@/pages/admin/ApprovedUsers'
import { PendingRequests } from '@/pages/admin/PendingRequests'
import { SettingsPage } from '@/pages/admin/SettingsPage'
import { ProtectedRoute } from '@/components/admin/ProtectedRoute'
import { AdminLayout } from '@/components/admin/AdminLayout'

function AppRoutes() {
  const { path } = useRouter()

  // 1. Admin Login
  if (path === '/admin/login') {
    return <AdminLogin />
  }

  // 2. Admin: All Communities Overview (Default Admin landing)
  if (path === '/admin' || path === '/admin/communities') {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <AllCommunitiesPage />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  // 2b. Admin: Community-Specific Member Management (/admin/communities/:slug/members)
  const commMembersMatch = path.match(/^\/admin\/communities\/([^/]+)\/members$/)
  if (commMembersMatch) {
    const slug = commMembersMatch[1]
    return (
      <ProtectedRoute>
        <AdminLayout>
          <CommunityMembersPage slug={slug} />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  // 3. Admin: Community Creation Requests Queue
  if (path === '/admin/community-requests') {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <CommunityRequestsPage />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  // 4. Admin: Approved Members Management
  if (path === '/admin/users') {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <ApprovedUsers />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  // 5. Admin: Pending Member Requests Management
  if (path === '/admin/requests') {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <PendingRequests />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  // 6. Admin: Settings
  if (path === '/admin/settings') {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <SettingsPage />
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  // 7. Public: Community Directory
  if (path === '/communities') {
    return <CommunityDirectory />
  }

  // 8. Public: Individual Community Leaderboard (e.g. /communities/joyboys)
  if (path.startsWith('/communities/')) {
    return <PublicLeaderboard />
  }

  // 9. Root / -> Default to JoyBoys community leaderboard
  return <PublicLeaderboard communitySlug="joyboys" />
}

export function App() {
  return (
    <RouterProvider>
      <AdminAuthProvider>
        <AppRoutes />
      </AdminAuthProvider>
    </RouterProvider>
  )
}

export default App
