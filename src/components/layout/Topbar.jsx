
import { useState } from 'react'
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
} from 'lucide-react'

export default function Topbar({
  searchValue,
  onSearchChange,
  onMenuClick,
  user,
  onSignOut,
}) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [signOutLoading, setSignOutLoading] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  const email = user?.email ?? 'Signed-in user'
  const displayName = email.split('@')[0]
  const initials =
    displayName
      .split(/[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U'

  async function handleSignOut() {
    setSignOutError('')
    setSignOutLoading(true)

    try {
      await onSignOut()
    } catch (error) {
      setSignOutError(error.message || 'Unable to sign out.')
    } finally {
      setSignOutLoading(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-[70px] items-center gap-3 border-b border-[#ececed] bg-white px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onMenuClick}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#ececed] bg-white text-[#53555e] transition hover:bg-[#f4f4f5] lg:hidden"
      >
        <Menu size={18} />
      </button>

      <div className="relative min-w-0 max-w-[460px] flex-1">
        <Search
          size={17}
          className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#9b9da5]"
        />

        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search memberships..."
          aria-label="Search memberships"
          className="h-[42px] w-full rounded-[11px] border border-[#ececed] bg-[#f4f4f5] py-2.5 pl-10 pr-3 text-[13px] text-[#131418] outline-none transition placeholder:text-[#9b9da5] focus:border-[#53555e] focus:bg-white"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          title="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#ececed] bg-white transition hover:bg-[#f4f4f5]"
        >
          <Bell size={18} className="text-[#6b6d76]" strokeWidth={1.8} />
          <span className="absolute right-[7px] top-[7px] h-2 w-2 rounded-full border-2 border-white bg-[#d24b3d]" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((value) => !value)}
            aria-expanded={accountOpen}
            className="flex items-center gap-2 rounded-xl border border-[#ececed] bg-white p-1.5 transition hover:bg-[#f4f4f5] sm:gap-2.5 sm:pl-1.5 sm:pr-3"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#53555e] to-[#1a1b20] text-[12px] font-bold text-white">
              {initials}
            </span>

            <span className="hidden max-w-[120px] text-left sm:block">
              <span className="block truncate text-[12px] font-semibold leading-4 text-[#131418]">
                {displayName}
              </span>
              <span className="mt-0.5 block text-[10px] leading-4 text-[#9b9da5]">
                Authorised user
              </span>
            </span>

            <ChevronDown
              size={15}
              className={`hidden text-[#9b9da5] transition sm:block ${
                accountOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {accountOpen && (
            <>
              <button
                type="button"
                aria-label="Close account menu"
                onClick={() => setAccountOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />

              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] overflow-hidden rounded-xl border border-[#ececed] bg-white shadow-[0_28px_64px_rgba(15,15,20,0.18)]">
                <div className="border-b border-[#f2f2f3] px-4 py-3.5">
                  <p className="text-[13px] font-semibold text-[#131418]">
                    Account
                  </p>
                  <p className="mt-1 break-all text-[11px] leading-5 text-[#9b9da5]">
                    {email}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 px-4 py-3 text-[12px] text-[#6b6d76]">
                  <ShieldCheck size={16} />
                  Signed in securely
                </div>

                {signOutError && (
                  <p className="px-4 pb-2 text-xs text-[#d24b3d]">
                    {signOutError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signOutLoading}
                  className="flex w-full items-center gap-2.5 border-t border-[#f2f2f3] px-4 py-3 text-left text-[12px] font-medium text-[#d24b3d] transition hover:bg-[#fbe9e6] disabled:opacity-50"
                >
                  <LogOut size={15} />
                  {signOutLoading ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
