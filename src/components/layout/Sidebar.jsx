
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Settings2,
  Users,
  X,
  MessageCircle,
  Crown,
  ChartNoAxesCombined,
} from "lucide-react";

export default function Sidebar({ open = false, onClose }) {
  const location = useLocation()

  const [membershipExpanded, setMembershipExpanded] = useState(true)
  const [eventsExpanded, setEventsExpanded] = useState(
    () => location.pathname.startsWith('/events'),
  )

  useEffect(() => {
    if (location.pathname.startsWith('/events')) {
      setEventsExpanded(true)
    }
  }, [location.pathname])

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2.5 rounded-r-lg border-l-2 px-3 py-[9px] text-[13px] transition ${
      isActive
        ? 'border-[#4f70e8] bg-white/[0.07] font-medium text-white'
        : 'border-transparent text-white/60 hover:bg-white/[0.05] hover:text-white'
    }`

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[264px] shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-[#131418] to-[#0b0c0f] text-[#eef3ee] shadow-xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-40 lg:translate-x-0 lg:shadow-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-[22px] pb-5 pt-[26px]">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[10px]">
            <img
              src="/favicon.svg"
              alt="Church Desk logo"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[15.5px] font-bold leading-tight text-white">
              Church Desk
            </p>
            <p className="mt-1 truncate text-[11.5px] tracking-[0.2px] text-white/55">
              ECI St. Stephen&apos;s Church
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 pb-6 pt-4">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">
            Workspace
          </p>

          {/* Existing Membership navigation */}
          <div className="mb-1">
            <button
              type="button"
              onClick={() =>
                setMembershipExpanded((value) => !value)
              }
              aria-expanded={membershipExpanded}
              className="flex w-full items-center gap-3 rounded-[10px] bg-white/[0.10] px-3 py-[11px] text-left text-[14px] font-medium text-white transition hover:bg-white/[0.13]"
            >
              <Users size={19} strokeWidth={1.8} />

              <span className="flex-1">Membership</span>

              <ChevronRight
                size={15}
                className={`text-white/60 transition-transform ${
                  membershipExpanded ? 'rotate-90' : ''
                }`}
              />
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-200 ${
                membershipExpanded
                  ? 'grid-rows-[1fr]'
                  : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="ml-[22px] mt-1 space-y-0.5 border-l border-white/[0.10] pl-2">
                  <NavLink
                    to="/"
                    end
                    onClick={onClose}
                    className={linkClass}
                  >
                    Memberships
                  </NavLink>

                  <NavLink
                    to="/members"
                    onClick={onClose}
                    className={linkClass}
                  >
                    Members
                  </NavLink>

                  <NavLink
                    to="/annual-register"
                    onClick={onClose}
                    className={linkClass}
                  >
                    Annual Membership Register
                  </NavLink>

                  <NavLink
                    to="/groups"
                    onClick={onClose}
                    className={linkClass}
                  >
                    Fellowships &amp; Groups
                  </NavLink>

                  <NavLink
                    to="/leadership"
                    onClick={onClose}
                    className={linkClass}
                  >
                    Leadership
                  </NavLink>
                </div>
              </div>
            </div>
          </div>

          {/* New Events navigation */}
          <div className="mb-1">
            <button
              type="button"
              onClick={() =>
                setEventsExpanded((value) => !value)
              }
              aria-expanded={eventsExpanded}
              className="flex w-full items-center gap-3 rounded-[10px] px-3 py-[11px] text-left text-[14px] font-medium text-white/90 transition hover:bg-white/[0.07]"
            >
              <CalendarDays
                size={19}
                strokeWidth={1.8}
                className="text-white/70"
              />

              <span className="flex-1">Events</span>

              <ChevronRight
                size={15}
                className={`text-white/60 transition-transform ${
                  eventsExpanded ? 'rotate-90' : ''
                }`}
              />
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-200 ${
                eventsExpanded
                  ? 'grid-rows-[1fr]'
                  : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="ml-[22px] mt-1 space-y-0.5 border-l border-white/[0.10] pl-2">
                  <NavLink
                    to="/events/church-calendar"
                    onClick={onClose}
                    className={linkClass}
                  >
                    Church Calendar
                  </NavLink>

                  <NavLink
                    to="/events/christmas-carols"
                    onClick={onClose}
                    className={linkClass}
                  >
                    Christmas Carols
                  </NavLink>

                  <NavLink
                    to="/events/special-events"
                    onClick={onClose}
                    className={linkClass}
                  >
                    Special Events
                  </NavLink>
                </div>
              </div>

              <NavLink
  to="/communications"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center gap-3 rounded-[10px] px-3 py-[11px] text-[13px] transition ${
      isActive
        ? "bg-white/[0.08] font-medium text-white"
        : "text-white/60 hover:bg-white/[0.05] hover:text-white"
    }`
  }
>
  <MessageCircle size={17} />
  <span>Communications</span>
</NavLink>
<NavLink
  to="/reports"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center gap-3 rounded-[10px] px-3 py-[11px] text-[13px] transition ${
      isActive
        ? "bg-white/[0.08] font-medium text-white"
        : "text-white/60 hover:bg-white/[0.05] hover:text-white"
    }`
  }
>
  <ChartNoAxesCombined size={17} />
  <span>Reports</span>
</NavLink>
            </div>
          </div>
        </nav>

        {/* Existing footer preserved */}
        <div className="border-t border-white/[0.08] p-4">
          <div className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3.5">
            <p className="text-xs font-medium text-white/80">
              Private workspace
            </p>
            <p className="mt-2 text-[11px] leading-[1.65] text-white/40">
              Access is restricted to authorised church personnel.
            </p>
          </div>

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-white/50 transition hover:bg-white/[0.06] hover:text-white/90"
          >
            <CircleHelp size={16} />
            Help and support
          </button>

          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-white/50 transition hover:bg-white/[0.06] hover:text-white/90"
          >
            <Settings2 size={16} />
            Workspace settings
          </button>

          <p className="px-3 pb-1 pt-4 text-[10px] text-white/30">
            Church Desk · v1.0
          </p>
        </div>
      </aside>
    </>
  )
}
