import { createContext, useContext } from 'react'

export const AppContext = createContext(null)

/** The app-wide state AppProvider holds: phase, profile and the session actions. */
export const useApp = () => useContext(AppContext)

/** AppModel.swift's rule: someone with nothing in their profile yet goes through onboarding. */
export const isEmptyProfile = (p) =>
  !p || (!p.headline && !p.targetRoles?.length && !p.skills?.length && !p.education?.length && !p.experience?.length)

/** Fills in the lists the server leaves out, so screens can map over them without checks. */
export const normalizeProfile = (p = {}) => ({
  headline: p.headline ?? null,
  targetRoles: p.targetRoles ?? [],
  goals: p.goals ?? [],
  skills: p.skills ?? [],
  education: p.education ?? [],
  experience: p.experience ?? [],
  projects: p.projects ?? [],
  certifications: p.certifications ?? [],
})
