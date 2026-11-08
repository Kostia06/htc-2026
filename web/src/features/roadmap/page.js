// RoadmapPage+Progress.swift: the page edits the screen makes before the server answers.
import { Award, Book, Calendar, Hammer, Heart, Mic, Send, Signpost, Users } from 'lucide-react'

export const KINDS = {
  project: { icon: Hammer, name: 'Project' },
  course: { icon: Book, name: 'Course' },
  event: { icon: Calendar, name: 'Event' },
  certification: { icon: Award, name: 'Certification' },
  volunteering: { icon: Heart, name: 'Volunteering' },
  application: { icon: Send, name: 'Application' },
  interview_practice: { icon: Mic, name: 'Interview practice' },
  networking_practice: { icon: Users, name: 'Networking' },
  explore_memory: { icon: Signpost, name: 'Crossroads' },
}
// a kind added on the server later still shows, as a generic project step
export const kindOf = (step) => KINDS[step.kind] ?? KINDS.project

export const LABELS = { ready_now: 'Ready now', stretch: 'Stretch', long_term: 'Long term' }

/** The `yyyy-MM-dd` key the server uses for completed days, in this browser's time zone. */
export function dayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Oldest finished step first, so the trail reads top to bottom as the journey so far. */
export const doneSteps = (page) => [...page.completed].reverse().flatMap((d) => [...d.steps].reverse())

export const allSteps = (page) => [...page.next, ...page.completed.flatMap((d) => d.steps)]

/** Adds the open steps this page doesn't have yet; the newer page's progress, cursor and days win. */
export function appendPage(page, more) {
  const known = new Set(page.next.map((s) => s.id))
  return {
    ...page,
    next: [...page.next, ...more.next.filter((s) => !known.has(s.id))],
    progress: more.progress,
    nextCursor: more.nextCursor,
    completed: more.completed,
  }
}

/** Moves an open step into today's group at once. Returns [page, previous] or null when it isn't open. */
export function completeStep(page, stepId, note, now = new Date()) {
  const previous = page.next.find((s) => s.id === stepId)
  if (!previous) return null
  const finished = { ...previous, status: 'done', completedAt: now.toISOString(), note: note || null }
  const day = dayKey(now)
  const completed = [...page.completed]
  const progress = { ...page.progress, done: page.progress.done + 1 }
  if (completed[0]?.day === day) completed[0] = { ...completed[0], steps: [finished, ...completed[0].steps] }
  else {
    completed.unshift({ day, steps: [finished] })
    progress.streakDays += 1
  }
  return [{ ...page, next: page.next.filter((s) => s.id !== stepId), completed, progress }, previous]
}

/** Undoes completeStep: the step goes back to the front of the open list. */
export function restoreStep(page, step) {
  let completed = page.completed
  const progress = { ...page.progress }
  const dayIndex = completed.findIndex((d) => d.steps.some((s) => s.id === step.id))
  if (dayIndex >= 0) {
    completed = completed
      .map((d, i) => (i === dayIndex ? { ...d, steps: d.steps.filter((s) => s.id !== step.id) } : d))
      .filter((d, i) => {
        if (i === dayIndex && d.steps.length === 0) {
          progress.streakDays = Math.max(0, progress.streakDays - 1)
          return false
        }
        return true
      })
    progress.done = Math.max(0, progress.done - 1)
  }
  return { ...page, completed, progress, next: [step, ...page.next] }
}

/** Puts the server's copy of a step wherever it sits. */
export function replaceStep(page, step) {
  const swap = (s) => (s.id === step.id ? step : s)
  return { ...page, next: page.next.map(swap), completed: page.completed.map((d) => ({ ...d, steps: d.steps.map(swap) })) }
}
