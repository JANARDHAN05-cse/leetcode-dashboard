import type { ReactNode } from 'react'
import { AdminSidebar } from './AdminSidebar'

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-row">
      <AdminSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto p-6 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

