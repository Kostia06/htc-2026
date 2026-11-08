// A small on-device cache so screens open instantly with what was there last time, then refresh quietly,
// the way the iOS app keeps the feed, companies and history on disk. Keys are per signed-in person.
let owner = 'anon'

/** Called once the session is known, so one person's cache never shows for another. */
export function setCacheOwner(userId) {
  owner = userId || 'anon'
}

const key = (name) => `raven:${owner}:${name}`

export function readCache(name) {
  try {
    return JSON.parse(localStorage.getItem(key(name)) ?? 'null')
  } catch {
    return null
  }
}

export function writeCache(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value))
  } catch {
    // private mode or full storage: the screen just loads from the network next time
  }
}

/** Forgets everything cached for the current person, on sign-out. */
export function clearCache() {
  try {
    const prefix = `raven:${owner}:`
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    // nothing to clear
  }
}

/** Plain per-device preferences, like the practice difficulty (@AppStorage on iOS). */
export function readPref(name, fallback) {
  try {
    return localStorage.getItem(`raven-pref:${name}`) ?? fallback
  } catch {
    return fallback
  }
}

export function writePref(name, value) {
  try {
    localStorage.setItem(`raven-pref:${name}`, value)
  } catch {
    // not saved; the default comes back next time
  }
}
