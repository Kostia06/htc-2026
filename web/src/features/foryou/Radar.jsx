// RadarList.swift: the companies Skillit keeps researching, under For you's Radar chip. Shares the Companies
// tab's cache, so switching between the two shows the same list at once.
import { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import { readCache, writeCache } from '../../lib/cache'
import { companiesApi } from '../../lib/client'
import { ContentUnavailable, SkeletonCard } from '../../ui/Feedback'
import { CompanyRow } from '../companies/Companies'

const CACHE = 'companies'

export default function Radar() {
  const [companies, setCompanies] = useState(() => readCache(CACHE))
  const [error, setError] = useState(null)

  useEffect(() => {
    companiesApi.list().then(
      (list) => {
        setCompanies(list)
        setError(null)
        writeCache(CACHE, list)
      },
      (e) => setError(e.message),
    )
  }, [])

  if (!companies && !error)
    return (
      <div className="foryou__grid">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} widths={[0.5, 0.8]} />
        ))}
      </div>
    )

  if (!companies?.length)
    return (
      <ContentUnavailable
        icon={Building2}
        title={error ? "Couldn't load companies" : 'No companies on your radar yet'}
        description={error ?? 'Skillit researches the companies on your road overnight.'}
      />
    )

  return (
    <div className="foryou__grid">
      {companies.map((c) => (
        <CompanyRow key={c.slug} company={c} />
      ))}
    </div>
  )
}
