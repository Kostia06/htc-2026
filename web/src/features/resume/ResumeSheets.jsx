// ResumeSectionEditor.swift at /resume/edit/:section.
import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router'
import { Plus } from 'lucide-react'
import { Sheet } from '../../ui/Sheet'
import { BLANK, SECTION_TITLES, SECTIONS } from './resumeDoc'

const splitList = (text) =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

const ENTRY = {
  experience: { name: 'Role', add: 'Add role', bulletHint: 'What you did and what came of it' },
  education: { name: 'School', add: 'Add school' },
  projects: { name: 'Project', add: 'Add project', bulletHint: 'What it does and what you built' },
}

export function SectionEditor() {
  const { section } = useParams()
  const navigate = useNavigate()
  const { resume, update } = useOutletContext()
  const [draft, setDraft] = useState(() => (resume ? structuredClone(resume) : null))
  const [lists, setLists] = useState(() => ({ links: resume?.contact.links.join(', ') ?? '', skills: resume?.skills.join(', ') ?? '' }))
  const back = () => navigate('/resume')

  useEffect(() => {
    if (!SECTIONS.includes(section)) navigate('/resume', { replace: true })
  }, [section, navigate])

  if (!draft) return null

  const save = () => {
    const next = { ...draft }
    if (section === 'contact') next.contact = { ...next.contact, links: splitList(lists.links) }
    if (section === 'skills') next.skills = splitList(lists.skills)
    update(next)
  }

  const setContact = (k) => (e) => setDraft((d) => ({ ...d, contact: { ...d.contact, [k]: e.target.value } }))
  const setEntry = (i, k, v) => setDraft((d) => ({ ...d, [section]: d[section].map((e, j) => (j === i ? { ...e, [k]: v } : e)) }))
  const setBullet = (i, b, v) => setEntry(i, 'bullets', draft[section][i].bullets.map((x, j) => (j === b ? v : x)))

  return (
    <Sheet
      onClose={back}
      size="large"
      header={{
        title: SECTION_TITLES[section],
        leading: (done) => (
          <button type="button" className="t-body c-action sheet-text-btn" onClick={done}>
            Cancel
          </button>
        ),
        trailing: (done) => (
          <button
            type="button"
            className="t-body semibold c-action sheet-text-btn"
            onClick={() => {
              save()
              done()
            }}
          >
            Done
          </button>
        ),
      }}
    >
      <div className="stack form-sheet">
        {section === 'contact' && (
          <>
            <div className="form-sheet__group">
              <input className="form-sheet__field t-body" placeholder="Name" aria-label="Name" value={draft.contact.name} onChange={setContact('name')} autoFocus />
              <input className="form-sheet__field t-body" placeholder="Email" aria-label="Email" type="email" value={draft.contact.email} onChange={setContact('email')} />
              <input className="form-sheet__field t-body" placeholder="Phone" aria-label="Phone" value={draft.contact.phone} onChange={setContact('phone')} />
            </div>
            <p className="form-sheet__header t-footnote">Links</p>
            <div className="form-sheet__group">
              <input
                className="form-sheet__field t-body"
                placeholder="github.com/you, linkedin.com/in/you"
                aria-label="Links"
                value={lists.links}
                onChange={(e) => setLists((l) => ({ ...l, links: e.target.value }))}
              />
            </div>
          </>
        )}

        {section === 'summary' && (
          <div className="form-sheet__group">
            <textarea
              className="form-sheet__field t-body"
              rows={6}
              placeholder="One or two lines about what you do and what you're after"
              aria-label="Summary"
              value={draft.summary}
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
              autoFocus
            />
          </div>
        )}

        {section === 'skills' && (
          <>
            <div className="form-sheet__group">
              <textarea
                className="form-sheet__field t-body"
                rows={4}
                placeholder="SQL, Python, Tableau"
                aria-label="Skills"
                value={lists.skills}
                onChange={(e) => setLists((l) => ({ ...l, skills: e.target.value }))}
                autoFocus
              />
            </div>
            <p className="form-sheet__footer t-footnote">Separate with commas.</p>
          </>
        )}

        {ENTRY[section] && (
          <>
            {draft[section].map((entry, i) => (
              <div key={i} className="stack resume-entry">
                <div className="row form-sheet__header resume-entry__head">
                  <span className="grow">
                    {ENTRY[section].name} {i + 1}
                  </span>
                  <button type="button" className="t-footnote c-negative" onClick={() => setDraft((d) => ({ ...d, [section]: d[section].filter((_, j) => j !== i) }))}>
                    Remove
                  </button>
                </div>
                <div className="form-sheet__group">
                  {section === 'experience' && (
                    <>
                      <input className="form-sheet__field t-body" placeholder="Role" aria-label="Role" value={entry.role} onChange={(e) => setEntry(i, 'role', e.target.value)} />
                      <input className="form-sheet__field t-body" placeholder="Organisation" aria-label="Organisation" value={entry.org} onChange={(e) => setEntry(i, 'org', e.target.value)} />
                      <div className="row resume-entry__dates">
                        <input className="form-sheet__field t-body grow" placeholder="Start" aria-label="Start" value={entry.start} onChange={(e) => setEntry(i, 'start', e.target.value)} />
                        <input className="form-sheet__field t-body grow" placeholder="End" aria-label="End" value={entry.end} onChange={(e) => setEntry(i, 'end', e.target.value)} />
                      </div>
                    </>
                  )}
                  {section === 'education' && (
                    <>
                      <input className="form-sheet__field t-body" placeholder="School" aria-label="School" value={entry.school} onChange={(e) => setEntry(i, 'school', e.target.value)} />
                      <input className="form-sheet__field t-body" placeholder="Program" aria-label="Program" value={entry.program} onChange={(e) => setEntry(i, 'program', e.target.value)} />
                      <input className="form-sheet__field t-body" placeholder="Year" aria-label="Year" value={entry.year} onChange={(e) => setEntry(i, 'year', e.target.value)} />
                    </>
                  )}
                  {section === 'projects' && (
                    <>
                      <input className="form-sheet__field t-body" placeholder="Name" aria-label="Name" value={entry.name} onChange={(e) => setEntry(i, 'name', e.target.value)} />
                      <input className="form-sheet__field t-body" placeholder="Link" aria-label="Link" value={entry.link} onChange={(e) => setEntry(i, 'link', e.target.value)} />
                    </>
                  )}
                  {entry.bullets?.map((b, j) => (
                    <input
                      key={j}
                      className="form-sheet__field t-body resume-entry__bullet"
                      placeholder={ENTRY[section].bulletHint}
                      aria-label={`Bullet ${j + 1}`}
                      value={b}
                      onChange={(e) => setBullet(i, j, e.target.value)}
                    />
                  ))}
                  {ENTRY[section].bulletHint && (
                    <button type="button" className="form-sheet__field t-body c-action resume-entry__add" onClick={() => setEntry(i, 'bullets', [...entry.bullets, ''])}>
                      <Plus size={16} strokeWidth={2.6} aria-hidden /> Add bullet
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" className="form-sheet__delete c-action resume-entry__new" onClick={() => setDraft((d) => ({ ...d, [section]: [...d[section], structuredClone(BLANK[section])] }))}>
              <Plus size={17} strokeWidth={2.6} aria-hidden /> {ENTRY[section].add}
            </button>
          </>
        )}
      </div>
    </Sheet>
  )
}
