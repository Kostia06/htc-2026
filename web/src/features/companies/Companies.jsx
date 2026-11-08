// CompaniesView.swift and CompanyView.swift: the companies Raven has researched, and everything it learned about one:
// facts by kind with their sources, and questions people were really asked once three have reported.
import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router'
import {
  Building2,
  ChevronRight,
  CircleCheck,
  ClockAlert,
  Cpu,
  Hand,
  ListOrdered,
  MessagesSquare,
  Mic,
  Newspaper,
  RefreshCw,
  TextQuote,
  UserPlus,
} from 'lucide-react'
import { readCache, readPref, writeCache } from '../../lib/cache'
import { companiesApi, hostOf } from '../../lib/client'
import { monthLabel, relative } from '../../lib/format'
import { RaisedButton, Spinner, TextButton } from '../../ui/Button'
import { Segmented } from '../../ui/Controls'
import { ContentUnavailable, SkeletonCard, ThinProgressBar } from '../../ui/Feedback'
import { BarButton, Page, PageHeader } from '../../ui/Layout'
import './companies.css'

const CACHE = 'companies'

export function CompaniesList() {
  const [companies, setCompanies] = useState(() => readCache(CACHE))
  const [error, setError] = useState(null)

  const load = useCallback(
    () =>
      companiesApi.list().then(
        (list) => {
          setCompanies(list)
          setError(null)
          writeCache(CACHE, list)
        },
        (e) => setError(e.message),
      ),
    [],
  )
  useEffect(() => {
    load()
  }, [load])

  return (
    <Page wide className="companies">
      <PageHeader title="Companies" large />
      {!companies && !error && (
        <div className="companies__grid">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} widths={[0.5, 0.8]} />
          ))}
        </div>
      )}
      {((error && !companies) || companies?.length === 0) && (
        <ContentUnavailable
          icon={Building2}
          title={error ? "Couldn't load companies" : 'Nothing researched yet'}
          description={error ?? 'Raven researches the companies on your roadmap overnight.'}
          className="companies__empty"
        >
          <RaisedButton onClick={load}>Try again</RaisedButton>
        </ContentUnavailable>
      )}
      {companies?.length > 0 && (
        <div className="companies__grid">
          {companies.map((c) => (
            <Link key={c.slug} to={`/companies/${c.slug}`} className="card company-row">
              <span className="monogram t-title3 bold">{c.name.charAt(0)}</span>
              <span className="grow stack">
                <span className="t-headline">{c.name}</span>
                <span className="t-subhead c-2 clamp-1">
                  {c.lastResearchedAt
                    ? `${c.factCount} facts · ${c.reportedCount} reports · Researched ${relative(c.lastResearchedAt)}`
                    : 'Not researched yet'}
                </span>
              </span>
              <ChevronRight size={16} strokeWidth={2.8} className="c-3" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </Page>
  )
}

const FACT_KINDS = [
  ['about', 'About', Building2],
  ['hiring', 'Hiring', UserPlus],
  ['interview', 'Interviews', MessagesSquare],
  ['interview_process', 'Interview process', ListOrdered],
  ['tech', 'Tech', Cpu],
  ['news', 'News', Newspaper],
]

export function CompanyView() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ phase: 'loading' })
  const [tab, setTab] = useState('facts')
  const [research, setResearch] = useState(null) // { status: running|done|refused, text }

  const load = useCallback(
    () =>
      companiesApi.insights(slug).then(
        (insights) => setState({ phase: 'ready', insights }),
        (e) => setState((s) => (s.insights ? s : { phase: 'failed', message: e.message })),
      ),
    [slug],
  )
  useEffect(() => {
    load()
  }, [load])

  // the research line clears itself after a few seconds
  useEffect(() => {
    if (!research || research.status === 'running') return undefined
    const t = setTimeout(() => setResearch(null), 4000)
    return () => clearTimeout(t)
  }, [research])

  const refresh = async () => {
    setResearch({ status: 'running' })
    try {
      const run = await companiesApi.research(slug)
      setResearch({ status: 'done', text: run.added ? `Found ${run.added} new ${run.added === 1 ? 'fact' : 'facts'}` : 'Up to date' })
      load()
    } catch (e) {
      setResearch({ status: 'refused', text: e.status === 429 ? 'Researched recently. Try again in a little while.' : e.message })
    }
  }

  const practice = () => {
    const params = new URLSearchParams({ company: slug, difficulty: readPref('practiceDifficulty', 'standard') })
    navigate(`/practice/session?${params}`)
  }

  const insights = state.insights
  const company = insights?.company
  const facts = insights?.facts ?? []
  const questions = insights?.questions ?? []
  const host = company?.website ? hostOf(company.website) : null
  const running = research?.status === 'running'

  return (
    <Page className="company">
      <PageHeader
        title={company?.name ?? 'Company'}
        back={{ to: '/companies', label: 'Companies' }}
        actions={insights && <BarButton icon={RefreshCw} label="Refresh research" onClick={refresh} disabled={running} />}
      />
      {state.phase === 'loading' && (
        <div className="stack company__stack">
          <SkeletonCard widths={[0.6, 0.35]} highlighted={-1} />
          <SkeletonCard />
          <SkeletonCard widths={[0.8, 0.6, 0.9]} />
        </div>
      )}
      {state.phase === 'failed' && (
        <ContentUnavailable icon={Building2} title="Couldn't load this company" description={state.message}>
          <RaisedButton onClick={load}>Try again</RaisedButton>
        </ContentUnavailable>
      )}
      {insights && (
        <div className="stack company__stack">
          <header className="company__header">
            <h1 className="t-title2">{company.name}</h1>
            <p className="t-subhead c-2">
              {[company.last_researched_at && `Researched ${relative(company.last_researched_at)}`].filter(Boolean).join('')}
              {company.last_researched_at && host && ' · '}
              {host && (
                <a href={company.website} target="_blank" rel="noreferrer">
                  {host}
                </a>
              )}
            </p>
            {research && (
              <p className={`t-subhead medium row company__research is-${research.status}`} role="status">
                {research.status === 'running' && (
                  <>
                    <Spinner size={14} /> Raven is researching…
                  </>
                )}
                {research.status === 'done' && (
                  <>
                    <CircleCheck size={16} strokeWidth={2.4} aria-hidden /> {research.text}
                  </>
                )}
                {research.status === 'refused' && (
                  <>
                    <ClockAlert size={16} strokeWidth={2.4} aria-hidden /> {research.text}
                  </>
                )}
              </p>
            )}
          </header>

          <RaisedButton icon={Mic} onClick={practice}>
            Practice an interview
          </RaisedButton>
          <TextButton icon={Hand} onClick={() => navigate('recap')} className="company__recap">
            I interviewed here, tell Raven
          </TextButton>

          {!facts.length && !questions.length ? (
            <ContentUnavailable icon={Building2} title="Nothing here yet" description="Raven will read the careers site, recent news and interview reports.">
              <RaisedButton variant="grey" onClick={refresh} disabled={running}>
                Refresh research
              </RaisedButton>
            </ContentUnavailable>
          ) : (
            <>
              <Segmented
                label="Show"
                options={[
                  { id: 'facts', title: 'Facts' },
                  { id: 'questions', title: 'Questions' },
                ]}
                value={tab}
                onChange={setTab}
              />
              {tab === 'facts' ? <Facts facts={facts} /> : <Questions reportCount={insights.reportCount} questions={questions} />}
            </>
          )}
        </div>
      )}
      <Outlet />
    </Page>
  )
}

function Facts({ facts }) {
  if (!facts.length) return <p className="t-subhead c-2 company__none">No facts yet. Refresh to research.</p>
  return (
    <div className="stack company__facts">
      {FACT_KINDS.map(([kind, label, Icon]) => {
        const rows = facts.filter((f) => f.kind === kind)
        if (!rows.length) return null
        return (
          <section key={kind} className="stack company__fact-section">
            <h2 className="t-caption semibold c-2 row company__fact-head">
              <Icon size={13} strokeWidth={2.4} aria-hidden /> {label}
            </h2>
            <div className="card company__rows">
              {rows.map((f) => (
                <FactRow key={`${f.kind}:${f.text}`} fact={f} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function FactRow({ fact }) {
  const [open, setOpen] = useState(false)
  const host = hostOf(fact.source_url)
  return (
    <div className="company__row">
      <button type="button" className={`t-subhead company__fact${open ? '' : ' clamp-2'}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        {fact.text}
      </button>
      {host && (
        <a href={fact.source_url} target="_blank" rel="noreferrer" className="t-caption c-2">
          {host}
        </a>
      )}
    </div>
  )
}

function Questions({ reportCount, questions }) {
  return (
    <div className="stack company__questions">
      {reportCount < 3 && (
        <div className="stack company__unlock">
          <p className="t-caption c-2">{reportCount} of 3 reports to unlock real questions</p>
          <ThinProgressBar value={reportCount / 3} tint="var(--positive)" label="Reports" />
        </div>
      )}
      {questions.length ? (
        <div className="card company__rows">
          {questions.map((q) => (
            <div key={q.text} className="row company__row company__question">
              <span className="company__count">
                {q.example ? <TextQuote size={18} className="c-3" aria-hidden /> : <span className="t-title3 semibold mono">{q.count}×</span>}
              </span>
              <span className="grow stack">
                <span className="t-subhead">{q.text}</span>
                <span className="t-caption c-2">{q.example ? 'Example' : monthLabel(q.last_reported_at)}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="t-subhead c-2 company__none">No questions yet.</p>
      )}
    </div>
  )
}
