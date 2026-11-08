// The job postings near the person (For you's jobs), each one a way into an interview built from that posting's
// own description: Practise saves the posting, then the interviewer asks about its responsibilities and requirements.
import { useEffect, useState } from 'react'
import { Briefcase, MapPin } from 'lucide-react'
import { feedApi, postingsApi } from '../../lib/client'
import { Spinner } from '../../ui/Button'

// what the posting import reads when the listing's site can't be fetched: everything the card already knows
const postingText = (job) => [`${job.title} at ${job.org}`, job.where && `Location: ${job.where}`, job.summary, job.level, job.format].filter(Boolean).join('\n')

async function savePosting(job) {
  try {
    if (job.url) return await postingsApi.import({ url: job.url })
  } catch {
    // many job sites block reading; the card's own description is enough to interview from
  }
  return postingsApi.import({ text: postingText(job) })
}

export default function NearbyJobs({ onPractise }) {
  const [jobs, setJobs] = useState(null)
  const [error, setError] = useState(null)
  const [working, setWorking] = useState(null)

  useEffect(() => {
    feedApi.page('jobs').then(
      (page) => setJobs(page.items ?? []),
      (e) => setError(e.message),
    )
  }, [])

  const practise = async (job) => {
    setWorking(job.id)
    setError(null)
    try {
      const saved = await savePosting(job)
      const id = saved?.posting?.id ?? saved?.id
      if (!id) throw new Error("That posting couldn't be read. Try another one.")
      onPractise(id)
    } catch (e) {
      setError(e.message)
      setWorking(null)
    }
  }

  return (
    <section className="stack practice__jobs" aria-label="Job postings near you">
      <p className="t-subhead c-2">Practise for a real job near you</p>
      {error && <p className="t-footnote c-red" role="alert">{error}</p>}
      {jobs === null && !error && <Spinner />}
      {jobs?.length === 0 && <p className="t-footnote c-2">No postings near you yet. Check For you in a little while.</p>}
      {jobs?.map((job) => (
        <button key={job.id} type="button" className="card practice__job" onClick={() => practise(job)} disabled={working !== null}>
          <Briefcase size={20} strokeWidth={2} className="c-action" aria-hidden />
          <span className="stack grow practice__job-text">
            <span className="t-headline">{job.title}</span>
            <span className="t-footnote c-2">
              {job.org}
              {job.where && (
                <>
                  {' · '}
                  <MapPin size={11} aria-hidden /> {job.where}
                </>
              )}
            </span>
          </span>
          {working === job.id ? <Spinner /> : <span className="t-subhead semibold c-action">Practise</span>}
        </button>
      ))}
    </section>
  )
}
