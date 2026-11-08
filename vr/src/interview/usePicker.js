import { useCallback, useEffect, useMemo, useState } from 'react'
import { callApi } from '../headset/api.js'
import { canAddCompany, companiesOf, launchOf, summaryOf, targetsOf } from './picker.js'

// Loads what the phone's "Interview for" offers (saved postings, the profile's
// target roles, local companies) and holds the candidate's choice. A list that
// fails to load just isn't offered; Begin still works with nothing picked.

async function getList(path, key, token) {
  try {
    const response = await callApi(path, { headers: { authorization: `Bearer ${token}` } })
    if (!response.ok) return []
    const body = await response.json()
    return Array.isArray(body?.[key]) ? body[key] : []
  } catch {
    return []
  }
}

export function usePicker(headset) {
  const token = headset?.phase === 'signedIn' ? headset.token : null
  const targetRoles = headset?.profile?.targetRoles
  const [postings, setPostings] = useState([])
  const [companyList, setCompanyList] = useState([])
  const [targetKey, setTargetKey] = useState(null)
  const [companySlug, setCompanySlug] = useState(null)
  const [difficulty, setDifficulty] = useState('standard')
  const [length, setLength] = useState('full')

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    Promise.all([getList('/api/postings', 'postings', token), getList('/api/companies', 'companies', token)]).then(([p, c]) => {
      if (cancelled) return
      setPostings(p)
      setCompanyList(c)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  const targets = useMemo(() => targetsOf({ postings, targetRoles: targetRoles ?? [] }), [postings, targetRoles])
  const companies = useMemo(() => companiesOf(companyList), [companyList])
  // like the phone's one-tap start: the first target role until something is picked
  const target = targets.find((t) => t.key === targetKey) ?? targets.find((t) => t.kind === 'role') ?? null
  const choice = { target, companySlug: canAddCompany(target) ? companySlug : null }

  const pickTarget = useCallback((key) => setTargetKey(key), [])
  const pickCompany = useCallback((slug) => setCompanySlug((was) => (was === slug ? null : slug)), [])

  return {
    available: Boolean(token),
    targets,
    companies,
    target,
    companySlug: choice.companySlug,
    difficulty,
    length,
    summary: summaryOf(choice, companies),
    launch: launchOf({ ...choice, difficulty, length }),
    pickTarget,
    pickCompany,
    setDifficulty,
    setLength,
  }
}
