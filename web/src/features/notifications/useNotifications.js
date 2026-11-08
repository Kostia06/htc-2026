// NotificationsModel.swift for the browser: the bell's list and unread count, refreshed on focus and every few
// minutes while the tab is open. Reads are optimistic; a refused call isn't worth bringing the dot back over.
import { useCallback, useEffect, useState } from 'react'
import { notificationsApi } from '../../lib/client'
import { useInterval } from '../../lib/hooks'

const POLL_MS = 5 * 60 * 1000

export function useNotifications() {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const page = await notificationsApi.page()
      setItems(page.items)
      setUnread(page.unread)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoaded(true)
    }
  }, [])

  useInterval(refresh, POLL_MS, true, true)
  useEffect(() => {
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])

  const markRead = useCallback((item) => {
    if (item.readAt) return
    const now = new Date().toISOString()
    setItems((list) => list.map((n) => (n.id === item.id ? { ...n, readAt: now } : n)))
    setUnread((n) => Math.max(0, n - 1))
    notificationsApi.read([item.id]).then((r) => setUnread(r.unread), () => {})
  }, [])

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString()
    setItems((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: now })))
    setUnread(0)
    notificationsApi.readAll().catch(() => {})
  }, [])

  return { items, unread, error, loaded, refresh, markRead, markAllRead }
}

/** Where a tap lands: the same routes the rest of the app links to. */
export function pathFor(target) {
  switch (target?.type) {
    case 'feed':
      return `/for-you/${encodeURIComponent(target.id)}`
    case 'company':
      return `/companies/${encodeURIComponent(target.slug)}`
    case 'step':
      return `/roadmap/step/${encodeURIComponent(target.id)}`
    case 'report':
      return `/practice/history/${encodeURIComponent(target.id)}`
    case 'resume':
      return `/resume/tailored/${encodeURIComponent(target.id)}`
    default:
      return null
  }
}

/** Today first, then everything earlier; empty groups are left out. */
export function groupByDay(items, now = new Date()) {
  const today = now.toDateString()
  const groups = [
    { title: 'Today', items: items.filter((n) => new Date(n.createdAt).toDateString() === today) },
    { title: 'Earlier', items: items.filter((n) => new Date(n.createdAt).toDateString() !== today) },
  ]
  return groups.filter((g) => g.items.length > 0)
}
