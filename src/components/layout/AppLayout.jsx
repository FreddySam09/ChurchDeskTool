
import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  async function handleSignOut() {
    await signOut()
    setSidebarOpen(false)
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-[#f4f4f5] text-[#131418]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onMenuClick={() => setSidebarOpen(true)}
          user={user}
          onSignOut={handleSignOut}
        />

        <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-7">
          <Outlet context={{ searchValue, setSearchValue }} />
        </main>

        <footer className="border-t border-[#e5e5e7] bg-white px-5 py-3.5 sm:px-8">
          <p className="text-[11px] text-[#9b9da5]">
            Church Desk <span className="px-1.5">·</span>
            ECI St. Stephen's Church
          </p>
        </footer>
      </div>
    </div>
  )
}
