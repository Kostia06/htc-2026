import { useCallback, useEffect, useMemo, useState } from 'react'
import { callApi } from '../headset/api.js'
import { canAddCompany, companiesOf, launchOf, postingTextOf, summaryOf, targetsOf } from './picker.js'

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

// a job near the person becomes a saved posting, so the interviewer can ask about its own description
async function savePosting(job, token) {
  const post = async (body) => {
    const response = await callApi('/api/postings', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return response.ok ? response.json() : null
  }
  // many job sites block reading; the card's own description is enough to interview from
  return (job.url && (await post({ url: job.url }).catch(() => null))) || post({ text: postingTextOf(job) })
}

export function usePicker(headset) {
  const token = headset?.phase === 'signedIn' ? headset.token : null
  const targetRoles = headset?.profile?.targetRoles
  const [postings, setPostings] = useState([])
  const [jobs, setJobs] = useState([])
  const [savingJob, setSavingJob] = useState(null)
  const [companyList, setCompanyList] = useState([])
  const [targetKey, setTargetKey] = useState(null)
  const [companySlug, setCompanySlug] = useState(null)
  const [difficulty, setDifficulty] = useState('standard')
  const [length, setLength] = useState('full')

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false
    Promise.all([getList('/api/postings', 'postings', token), getList('/api/companies', 'companies', token), getList('/api/feed?section=jobs', 'items', token)]).then(([p, c, j]) => {
      if (cancelled) return
      setPostings(p)
      setJobs(j)
      setCompanyList(c)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  const targets = useMemo(() => targetsOf({ postings, targetRoles: targetRoles ?? [], jobs }), [postings, targetRoles, jobs])
  const companies = useMemo(() => companiesOf(companyList), [companyList])
  // nothing picked is a general interview for the profile's target role, chosen by the server
  const target = targets.find((t) => t.key === targetKey) ?? null
  const choice = { target, companySlug: canAddCompany(target) ? companySlug : null }

  const pickTarget = useCallback(
    async (key) => {
      const job = targets.find((t) => t.key === key && t.kind === 'job')
      if (!job) return setTargetKey(key)
      setSavingJob(key)
      try {
        const posting = await savePosting(job.job, token)
        if (!posting?.id) return
        setPostings((list) => [posting, ...list.filter((p) => p.id !== posting.id)])
        setTargetKey(`posting:${posting.id}`)
      } finally {
        setSavingJob(null)
      }
    },
    [targets, token],
  )
  const pickCompany = useCallback((slug) => setCompanySlug((was) => (was === slug ? null : slug)), [])

  return {
    available: Boolean(token),
    targets,
    companies,
    target,
    companySlug: choice.companySlug,
    difficulty,
    length,
    summary: savingJob ? 'Reading the posting…' : summaryOf(choice, companies),
    savingJob,
    launch: launchOf({ ...choice, difficulty, length }),
    pickTarget,
    pickCompany,
    setDifficulty,
    setLength,
  }
}
