// MainTabView.swift for a browser: the five tabs as a glass sidebar on wide screens, and as a floating glass
// tab bar on phones that shrinks while scrolling down (tabBarMinimizeBehavior(.onScrollDown)).
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Building2, CircleUserRound, GalleryVerticalEnd, Glasses, Route } from 'lucide-react'

const TABS = [
  { to: '/roadmap', label: 'Roadmap', icon: Route },
  { to: '/for-you', label: 'For you', icon: GalleryVerticalEnd },
  { to: '/practice', label: 'Practice', icon: Glasses },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/profile', label: 'Profile', icon: CircleUserRound, also: ['/settings'] },
]

const isActive = (tab, pathname) => [tab.to, ...(tab.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`))

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
            R
          </span>
          <span className="sidebar__word">raven</span>
        </div>
        <nav aria-label="Main">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} className={() => `sidebar__item${isActive(tab, pathname) ? ' is-active' : ''}`}>
              <tab.icon size={20} strokeWidth={2.1} aria-hidden />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="shell__content">
        <Outlet />
      </div>

      <nav className={`tabbar glass-strong${minimized ? ' is-minimized' : ''}`} aria-label="Main">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={() => `tabbar__item${isActive(tab, pathname) ? ' is-active' : ''}`}
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
