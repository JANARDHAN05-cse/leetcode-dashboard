import { useRouter } from '@/context/RouterContext'
import { useAdminAuth } from '@/context/AdminAuthContext'
import {
  UsersIcon,
  InboxIcon,
  SettingsIcon,
  LogOutIcon,
  TrophyIcon,
} from '@/components/icons/Icons'

export function AdminSidebar() {
  const { path, navigate } = useRouter()
  const { pendingCount, communityRequestsCount, logout, admin } = useAdminAuth()

  const isPlatformAdmin = !admin?.role || admin.role === 'platform_admin'

  const navItems = [
    ...(isPlatformAdmin
      ? [
          {
            id: 'communities',
            label: 'All Communities',
            path: '/admin/communities',
            icon: TrophyIcon,
          },
          {
            id: 'community-requests',
            label: 'Community Requests',
            path: '/admin/community-requests',
            icon: InboxIcon,
            badge: communityRequestsCount > 0 ? communityRequestsCount : null,
          },
        ]
      : []),
    {
      id: 'users',
      label: 'Approved Members',
      path: '/admin/users',
      icon: UsersIcon,
    },
    {
      id: 'requests',
      label: 'Member Requests',
      path: '/admin/requests',
      icon: InboxIcon,
      badge: pendingCount > 0 ? pendingCount : null,
    },
    {
      id: 'settings',
      label: 'Settings',
      path: '/admin/settings',
      icon: SettingsIcon,
    },
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login')
  }

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0 h-screen sticky top-0 select-none">
      {/* Brand & Admin Badge */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100 gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FFA116] to-[#F89F1B] flex items-center justify-center text-white shadow-xs">
          <TrophyIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm tracking-tight text-gray-900 leading-none">
            LeetCode
          </span>
          <span className="text-[11px] font-medium text-amber-600 mt-0.5 tracking-wider uppercase">
            {isPlatformAdmin ? 'Platform Admin' : 'Community Owner'}
          </span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            path === item.path ||
            (item.id === 'communities' && (path === '/admin' || path.startsWith('/admin/communities')))

          const IconComponent = item.icon

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-amber-50 text-[#F89F1B]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <IconComponent
                  className={`w-4 h-4 ${isActive ? 'text-[#F89F1B]' : 'text-gray-400'}`}
                />
                <span>{item.label}</span>
              </div>

              {item.badge !== null && item.badge !== undefined && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-[#F89F1B] rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer & Log Out */}
      <div className="p-3 border-t border-gray-100">
        <div className="px-3.5 py-2 mb-2 flex items-center justify-between text-xs text-gray-500">
          <span>Signed in as:</span>
          <span className="font-semibold text-gray-700 truncate max-w-[100px]">
            {admin?.username || 'admin'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-md text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOutIcon className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  )
}
