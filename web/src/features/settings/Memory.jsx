// MemoryView.swift and ShareMemorySheet.swift: what Raven remembers, grouped by kind. Delete any of it; share a note
// anonymously with people preparing for the same company.
import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate, useOutletContext, useParams } from 'react-router'
import { ArrowUpRight, Brain, CircleCheck, Flag, LockKeyhole, ShieldCheck, Share2, SlidersHorizontal, Star, StickyNote, Trash2 } from 'lucide-react'
import { companiesApi, memoriesApi } from '../../lib/client'
import { relative } from '../../lib/format'
import { RaisedButton } from '../../ui/Button'
import { ContentUnavailable, Flash, SkeletonCard } from '../../ui/Feedback'
import { Group, Page, PageHeader } from '../../ui/Layout'
import { Sheet } from '../../ui/Sheet'
import './settings.css'

const KINDS = [
  ['goal', 'Goals', Flag],
  ['skill', 'Skills', Star],
  ['weakness', 'Working on', ArrowUpRight],
  ['preference', 'Preferences', SlidersHorizontal],
  ['note', 'Notes', StickyNote],
]

const detailOf = (m) =>
  [relative(m.createdAt) && `Added ${relative(m.createdAt)}`, m.uses > 0 && `Used ${m.uses} ${m.uses === 1 ? 'time' : 'times'}`].filter(Boolean).join(' · ')

export function Memory() {
  const navigate = useNavigate()
  const [state, setState] = useState({ phase: 'loading' })
  const [notice, setNotice] = useState(null)

  const load = useCallback(
    () =>
      memoriesApi.list().then(
        (memories) => setState({ phase: 'ready', memories }),
        (e) => setState({ phase: 'failed', message: e.message }),
      ),
    [],
  )
  useEffect(() => {
    load()
  }, [load])

  /** Gone at once; a refused delete puts the row back with a short notice. */
  const forget = async (memory) => {
    setState((s) => ({ ...s, memories: s.memories.filter((m) => m.id !== memory.id) }))
    try {
      await memoriesApi.forget(memory.id)
    } catch (e) {
      setState((s) => ({ ...s, memories: [...s.memories, memory] }))
      setNotice(e.message)
    }
  }

  const memories = state.memories ?? []
  return (
    <Page className="settings">
      <PageHeader title="What Raven remembers" back={{ to: '/settings/privacy', label: 'Your data' }} />
      <div className="stack settings__stack">
        <div className="card row memory-explainer">
          <ShieldCheck size={22} strokeWidth={2} className="c-agent" aria-hidden />
          <div className="stack">
            <span className="t-headline">Private to you</span>
            <span className="t-subhead c-2">
              Encrypted with a key only your account holds. Raven uses these to shape your roadmap and practice. Delete any of them, any time; nothing leaves unless you
              share a note.
            </span>
          </div>
        </div>

        {state.phase === 'loading' && [0, 1, 2].map((i) => <SkeletonCard key={i} widths={[0.8, 0.5]} />)}
        {state.phase === 'failed' && (
          <ContentUnavailable icon={Brain} title="Couldn't load memories" description={state.message}>
            <RaisedButton onClick={load}>Try again</RaisedButton>
          </ContentUnavailable>
        )}
        {state.phase === 'ready' && !memories.length && <p className="t-body c-2 memory-empty">Nothing yet. Raven starts remembering as you practise and finish steps.</p>}

        {KINDS.map(([kind, label, Icon]) => {
          const rows = memories.filter((m) => m.kind === kind)
          if (!rows.length) return null
          return (
            <Group
              key={kind}
              header={
                <span className="row memory-head">
                  <Icon size={13} strokeWidth={2.4} aria-hidden /> {label}
                </span>
              }
              footer={kind === 'note' ? 'Share a note anonymously with people preparing for the same company.' : undefined}
            >
              {rows.map((m) => (
                <div key={m.id} className="group-row memory-row">
                  <span className="grow group-row__content">
                    <span className="t-body">{m.text}</span>
                    <span className="t-caption c-2">{detailOf(m)}</span>
                  </span>
                  <span className="row memory-row__actions">
                    {kind === 'note' && (
                      <button type="button" className="memory-row__btn c-agent" onClick={() => navigate(`/settings/memory/${m.id}/share`)} aria-label="Share anonymously" title="Share anonymously">
                        <Share2 size={17} strokeWidth={2.2} aria-hidden />
                      </button>
                    )}
                    <button type="button" className="memory-row__btn is-delete" onClick={() => forget(m)} aria-label="Delete" title="Delete">
                      <Trash2 size={17} strokeWidth={2.2} aria-hidden />
                    </button>
                  </span>
                </div>
              ))}
            </Group>
          )
        })}
      </div>
      <Flash message={notice} tone="neutral" duration={3000} onDone={() => setNotice(null)} />
      <Outlet context={{ memories }} />
    </Page>
  )
}

export function ShareMemory() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { memories } = useOutletContext()
  const memory = memories.find((m) => m.id === id)
  const [companies, setCompanies] = useState(null)
  const [companySlug, setCompanySlug] = useState('')
  const [role, setRole] = useState('')
  const [phase, setPhase] = useState('editing') // editing | sending | sent
  const [error, setError] = useState(null)

  useEffect(() => {
    companiesApi.list().then(
      (list) => {
        setCompanies(list)
        setCompanySlug((s) => s || list[0]?.slug || '')
      },
      () => setCompanies([]),
    )
  }, [])

  const share = async () => {
    setPhase('sending')
    setError(null)
    try {
      await memoriesApi.share(id, companySlug, role.trim())
      setPhase('sent')
    } catch (e) {
      setError(e.message)
      setPhase('editing')
    }
  }

  const close = () => navigate('/settings/memory')
  return (
    <Sheet
      onClose={close}
      size="detail"
      header={{
        title: 'Share anonymously',
        leading: (done) => (
          <button type="button" className="t-body c-action sheet-text-btn" onClick={done}>
            {phase === 'sent' ? 'Done' : 'Cancel'}
          </button>
        ),
      }}
      footer={
        phase !== 'sent' && (
          <RaisedButton variant="agent" onClick={share} busy={phase === 'sending'} disabled={!companySlug || !role.trim() || !memory || phase === 'sending'}>
            Share
          </RaisedButton>
        )
      }
    >
      {(done) =>
        phase === 'sent' ? (
          <div className="share-sent">
            <CircleCheck size={64} strokeWidth={1.6} className="c-agent" aria-hidden />
            <h2 className="t-title3 bold">Thanks — this helps the next person</h2>
            <RaisedButton variant="agent" onClick={done}>
              Done
            </RaisedButton>
          </div>
        ) : (
          <div className="stack form-sheet">
            <p className="form-sheet__header t-footnote">Your note</p>
            <div className="form-sheet__group">
              <p className="form-sheet__field t-body share-note">{memory?.text ?? '…'}</p>
            </div>
            <div className="form-sheet__group share-fields">
              <label className="row form-sheet__field share-picker">
                <span className="grow">Company</span>
                <select value={companySlug} onChange={(e) => setCompanySlug(e.target.value)} aria-label="Company">
                  {!companies && <option value="">Loading…</option>}
                  {companies?.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <input className="form-sheet__field t-body" placeholder="Role you interviewed for" aria-label="Role you interviewed for" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <p className="form-sheet__footer t-footnote row share-footnote">
              <LockKeyhole size={14} strokeWidth={2.2} aria-hidden />
              <span>
                A scrubbed copy goes into that company&rsquo;s interview reports: names and contact details are removed first, and it only shows once 3 people report similar
                questions. Your private note stays as it is.
              </span>
            </p>
            {error && <p className="t-footnote c-negative">{error}</p>}
          </div>
        )
      }
    </Sheet>
  )
}
