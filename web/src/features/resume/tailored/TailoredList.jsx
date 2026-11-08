// TailoredResumesSection.swift: the versions made for specific jobs, beside the builder, and the way to make another.
import { useNavigate } from 'react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { relative } from '../../../lib/format'
import { RaisedButton } from '../../../ui/Button'
import { matchLine } from './match'

export default function TailoredList({ list }) {
  const navigate = useNavigate()
  return (
    <section className="card stack tailored" aria-label="Your resumes">
      <div className="stack tailored__intro">
        <h2 className="t-headline">Your resumes</h2>
        <p className="t-footnote c-2">A copy of your resume adapted to one job. Your base resume stays as it is.</p>
      </div>
      {list.failed && <p className="t-footnote c-negative">Couldn&rsquo;t load your tailored resumes. Reload to try again.</p>}
      {list.items.length > 0 && (
        <ul className="stack tailored__rows">
          {list.items.map((item) => (
            <li key={item.id}>
              <button type="button" className="row tailored__row" onClick={() => navigate(`/resume/tailored/${item.id}`)}>
                <span className="stack grow tailored__row-text">
                  <span className="t-subhead semibold">{item.title}</span>
                  <span className="t-footnote c-2">{item.company}</span>
                  <span className="t-caption c-3">
                    {matchLine(item.covered, item.total)}
                    {item.updatedAt && ` · Updated ${relative(item.updatedAt)}`}
                  </span>
                </span>
                <ChevronRight size={16} strokeWidth={2.6} className="c-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <RaisedButton variant="secondary" icon={Plus} onClick={() => navigate('/resume/tailor')}>
        Tailor for a job
      </RaisedButton>
    </section>
  )
}
