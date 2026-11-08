// MainTabView.swift for a browser: the five tabs as a glass sidebar on wide screens, and as a floating glass
// tab bar on phones that shrinks while scrolling down (tabBarMinimizeBehavior(.onScrollDown)). The sidebar also
// lists the resume builder, the web's own tool; on phones it opens from Profile, so Profile stays lit there.
import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Building2, CircleUserRound, FileText, GalleryVerticalEnd, Glasses, Route, Signpost } from 'lucide-react'
import { Spinner } from '../ui/Button'
import { Bell } from '../features/notifications/Bell'

// Crossroads is sidebar-only like Resume: on phones it opens from its step on the road, keeping the tab bar at five
const TABS = [
  { to: '/roadmap', label: 'Road', icon: Route },
  { to: '/crossroads', label: 'Crossroads', icon: Signpost, sidebarOnly: true },
  { to: '/for-you', label: 'For you', icon: GalleryVerticalEnd },
  { to: '/practice', label: 'Practice', icon: Glasses },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/resume', label: 'Resume', icon: FileText, sidebarOnly: true },
  { to: '/profile', label: 'Profile', icon: CircleUserRound, also: ['/settings', '/resume'] },
]
const SIDEBAR = TABS
const TABBAR = TABS.filter((tab) => !tab.sidebarOnly)

const matches = (tab, pathname) => [tab.to, ...(tab.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`))
/** The first tab in the list that claims the path, so Resume wins over Profile wherever both are shown. */
const activeTab = (tabs, pathname) => tabs.find((tab) => matches(tab, pathname))

export function Ambient() {
  return (
    <div className="ambient" aria-hidden>
      <span />
      <i />
    </div>
  )
}

export function Shell() {
  const { pathname } = useLocation()
  const [minimized, setMinimized] = useState(false)
  const sidebarActive = activeTab(SIDEBAR, pathname)
  const tabbarActive = activeTab(TABBAR, pathname)

  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (Math.abs(y - last) < 8) return
      setMinimized(y > last && y > 80)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="shell">
      <Ambient />
      <aside className="sidebar glass-strong">
        <div className="sidebar__brand">
          <span className="sidebar__mark" aria-hidden>
            S
          </span>
          <span className="sidebar__word">skillit</span>
        </div>
        <nav aria-label="Main">
          {SIDEBAR.map((tab) => (
            <NavLink key={tab.to} to={tab.to} className={() => `sidebar__item${tab === sidebarActive ? ' is-active' : ''}`}>
              <tab.icon size={20} strokeWidth={2.1} aria-hidden />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <Bell />

      <div className="shell__content">
        {/* a tab's first visit loads its code; the sidebar and tab bar stay put meanwhile */}
        <Suspense
          fallback={
            <div className="shell__loading">
              <Spinner />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </div>

      <nav className={`tabbar glass-strong${minimized ? ' is-minimized' : ''}`} aria-label="Main">
        {TABBAR.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={() => `tabbar__item${tab === tabbarActive ? ' is-active' : ''}`}
            onClick={() => setMinimized(false)}
          >
            <tab.icon size={22} strokeWidth={2.1} aria-hidden />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
