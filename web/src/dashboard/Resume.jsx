// The resume builder: the resume Raven already has (saved, or laid out from the one uploaded at onboarding), an editor,
// and the resume-coach skill's rewrites to accept or skip. It only asks for a file when Raven has nothing to start from.
import { useEffect, useRef, useState } from 'react'
import { resume as resumeApi, toSlug } from '../lib/agent'
import { RESUME_ACCEPT } from '../onboarding/store'
import { Problem, Thinking } from './ui'

const ADD_NUMBER = '[add number]'
const SECTIONS = [
  ['', 'Whole resume'],
  ['summary', 'Summary'],
  ['experience', 'Experience'],
  ['projects', 'Projects'],
]
const BLANK = {
  experience: { role: '', org: '', start: '', end: '', bullets: [] },
  education: { school: '', program: '', year: '' },
  projects: { name: '', link: '', bullets: [] },
}

// a path is what the coach echoes back, e.g. experience[0].bullets[1]; the editor uses the same form, e.g. contact.name
const SEGMENT = /([a-zA-Z]+)|\[(\d+)\]/g
const keysOf = (path) => [...path.matchAll(SEGMENT)].map((m) => m[1] ?? Number(m[2]))

function readPath(doc, path) {
  let current = doc
  for (const key of keysOf(path)) {
    if (current === null || typeof current !== 'object') return undefined
    current = current[key]
  }
  return typeof current === 'string' ? current : undefined
}

function writePath(doc, path, value) {
  const keys = keysOf(path)
  const copy = (node, i) => {
    if (i === keys.length) return value
    const next = Array.isArray(node) ? [...node] : { ...node }
    next[keys[i]] = copy(node?.[keys[i]], i + 1)
    return next
  }
  return copy(doc, 0)
}

const same = (a = '', b = '') => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim()

// the lines the coach may rewrite, mirroring editablePaths on the server
function coachLines(doc, section) {
  const want = (s) => !section || section === s
  return [
    ...(want('summary') && doc.summary.trim() ? [doc.summary] : []),
    ...(want('experience') ? doc.experience.flatMap((e) => e.bullets) : []),
    ...(want('projects') ? doc.projects.flatMap((p) => p.bullets) : []),
  ].filter((line) => line.trim())
}

function labelFor(doc, path) {
  const [section, index] = keysOf(path)
  if (section === 'summary') return 'Summary'
  const entry = doc[section]?.[index]
  if (section === 'experience') return ['Experience', [entry?.role, entry?.org].filter(Boolean).join(' at ')].filter(Boolean).join(' · ')
  return ['Project', entry?.name].filter(Boolean).join(' · ')
}

const splitList = (text) => text.split(/,\s?/)

function download(blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Resume.pdf'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "[add number]" is the one thing the person must fill in, so it is the one thing highlighted. */
function WithBlanks({ text }) {
  return text.split(ADD_NUMBER).map((part, i) => (
    <span key={i}>
      {i > 0 && <mark className="rs__blank">{ADD_NUMBER}</mark>}
      {part}
    </span>
  ))
}

function Field({ label, value, onChange, ...rest }) {
  return (
    <label className="ob__field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </label>
  )
}

function Lines({ label, lines, onChange, hint }) {
  return (
    <label className="ob__field">
      <span>{label}</span>
      <textarea
        className="db__answer"
        rows={Math.max(3, lines.length + 1)}
        value={lines.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n'))}
      />
      {hint && <small className="rs__hint">{hint}</small>}
    </label>
  )
}

function FilePicker({ busy, onFile, children }) {
  const input = useRef(null)
  const [over, setOver] = useState(false)
  const pick = (file) => file && onFile(file)
  return (
    <>
      <input ref={input} type="file" accept={RESUME_ACCEPT} hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
      {children ? (
        <button type="button" className="db__link" disabled={busy} onClick={() => input.current?.click()}>{children}</button>
      ) : (
        <button
          type="button"
          className={`ob__drop${over ? ' is-over' : ''}`}
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => (e.preventDefault(), setOver(false), pick(e.dataTransfer.files?.[0]))}
        >
          <strong>Upload your resume</strong>
          <span>PDF, Word or a photo · drop it here or click</span>
        </button>
      )}
    </>
  )
}

function Suggestions({ items, doc, onAccept, onSkip }) {
  const current = items[0]
  if (!current) return null
  const stale = !same(readPath(doc, current.path), current.before)
  return (
    <section className="rs__deck" aria-live="polite" aria-label="Raven's suggestions">
      <div className="db__item-head">
        <h3 className="db__h3">Raven suggests</h3>
        <span className="db__muted">{items.length} left</span>
      </div>
      <article className="db__item rs__suggestion" key={current.path}>
        <p className="rs__where">{labelFor(doc, current.path)}</p>
        <p className="rs__before">{current.before}</p>
        <p className="rs__after"><WithBlanks text={current.after} /></p>
        {current.why && <p className="rs__why">{current.why}</p>}
        {stale && <p className="db__muted">This line has changed since Raven read it, so it can only be skipped.</p>}
        <div className="db__row">
          <button type="button" className="db__ghost" onClick={() => onSkip(current)}>Skip</button>
          <button type="button" className="ob__next" disabled={stale} onClick={() => onAccept(current)}>Accept</button>
        </div>
      </article>
    </section>
  )
}

function Entries({ title, items, addLabel, onAdd, onRemove, render }) {
  return (
    <section className="rs__group">
      <h3 className="db__h3">{title}</h3>
      {items.map((item, i) => (
        <div key={i} className="db__item rs__entry">
          {render(item, i)}
          <button type="button" className="db__link rs__remove" onClick={() => onRemove(i)}>Remove</button>
        </div>
      ))}
      <button type="button" className="db__ghost rs__add" onClick={onAdd}>{addLabel}</button>
    </section>
  )
}

function Editor({ doc, set }) {
  const add = (section) => set(section, [...doc[section], BLANK[section]])
  const remove = (section) => (i) => set(section, doc[section].filter((_, j) => j !== i))

  return (
    <>
      <section className="rs__group">
        <h3 className="db__h3">Contact</h3>
        <div className="db__pair">
          <Field label="Name" value={doc.contact.name} onChange={(v) => set('contact.name', v)} autoComplete="name" />
          <Field label="Email" value={doc.contact.email} onChange={(v) => set('contact.email', v)} type="email" autoComplete="email" />
          <Field label="Phone" value={doc.contact.phone} onChange={(v) => set('contact.phone', v)} type="tel" autoComplete="tel" />
          <Field label="Links (comma separated)" value={doc.contact.links.join(', ')} onChange={(v) => set('contact.links', splitList(v))} placeholder="linkedin.com/in/you, github.com/you" />
        </div>
        <p className="rs__hint">Raven never sends your contact details to the AI.</p>
      </section>

      <section className="rs__group">
        <h3 className="db__h3">Summary</h3>
        <textarea className="db__answer" rows={3} aria-label="Summary" value={doc.summary} maxLength={800} onChange={(e) => set('summary', e.target.value)} />
      </section>

      <Entries
        title="Experience"
        items={doc.experience}
        addLabel="Add experience"
        onAdd={() => add('experience')}
        onRemove={remove('experience')}
        render={(e, i) => (
          <>
            <div className="db__pair">
              <Field label="Role" value={e.role} onChange={(v) => set(`experience[${i}].role`, v)} />
              <Field label="Organisation" value={e.org} onChange={(v) => set(`experience[${i}].org`, v)} />
              <Field label="Start" value={e.start} onChange={(v) => set(`experience[${i}].start`, v)} placeholder="May 2025" />
              <Field label="End" value={e.end} onChange={(v) => set(`experience[${i}].end`, v)} placeholder="Present" />
            </div>
            <Lines label="What you did" lines={e.bullets} onChange={(v) => set(`experience[${i}].bullets`, v)} hint="One point per line." />
          </>
        )}
      />

      <Entries
        title="Education"
        items={doc.education}
        addLabel="Add education"
        onAdd={() => add('education')}
        onRemove={remove('education')}
        render={(e, i) => (
          <div className="db__pair">
            <Field label="School" value={e.school} onChange={(v) => set(`education[${i}].school`, v)} />
            <Field label="Program" value={e.program} onChange={(v) => set(`education[${i}].program`, v)} />
            <Field label="Year" value={e.year} onChange={(v) => set(`education[${i}].year`, v)} placeholder="2027" />
          </div>
        )}
      />

      <Entries
        title="Projects"
        items={doc.projects}
        addLabel="Add project"
        onAdd={() => add('projects')}
        onRemove={remove('projects')}
        render={(p, i) => (
          <>
            <div className="db__pair">
              <Field label="Name" value={p.name} onChange={(v) => set(`projects[${i}].name`, v)} />
              <Field label="Link" value={p.link} onChange={(v) => set(`projects[${i}].link`, v)} placeholder="github.com/you/project" />
            </div>
            <Lines label="What it does" lines={p.bullets} onChange={(v) => set(`projects[${i}].bullets`, v)} hint="One point per line." />
          </>
        )}
      />

      <section className="rs__group">
        <h3 className="db__h3">Skills</h3>
        <Field label="Comma separated" value={doc.skills.join(', ')} onChange={(v) => set('skills', splitList(v))} placeholder="Python, SQL, Figma" />
      </section>
    </>
  )
}

export default function ResumeBuilder({ answers, defaultRole }) {
  const onboardingFile = answers.resume?.fileName
  const [phase, setPhase] = useState('loading') // loading | failed | start | ready
  const [loadError, setLoadError] = useState(null)
  const [doc, setDoc] = useState(null)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [origin, setOrigin] = useState(null) // where the resume on screen came from: { kind, fileName, droppedClaims, replaced }
  const [busy, setBusy] = useState(null) // reading | improving | saving | pdf
  const [error, setError] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [coachNote, setCoachNote] = useState(null)
  const [section, setSection] = useState('')
  const [company, setCompany] = useState('')

  const show = ({ resume, saved: isSaved }) => {
    setDoc(resume)
    setSaved(isSaved)
    setDirty(false)
    setSuggestions([])
    setCoachNote(null)
    setError(null)
    // anything already uploaded (at onboarding it went into the profile, which the server lays out as a resume) is used
    // as is; a file is only asked for when Raven has nothing to start from
    const fromProfile = resume.experience.length > 0 || resume.projects.length > 0
    if (isSaved) setOrigin({ kind: 'saved' })
    else if (onboardingFile) setOrigin({ kind: 'onboarding', fileName: onboardingFile })
    else if (fromProfile) setOrigin({ kind: 'profile' })
    setPhase(isSaved || onboardingFile || fromProfile ? 'ready' : 'start')
  }
  const fail = (e) => {
    setLoadError(e)
    setPhase('failed')
  }
  const fetchResume = () => resumeApi.load().then(show, fail)

  useEffect(() => {
    fetchResume()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reload = () => {
    setPhase('loading')
    fetchResume()
  }

  const set = (path, value) => {
    setDoc((d) => writePath(d, path, value))
    setDirty(true)
  }

  const read = async (file) => {
    setBusy('reading')
    setError(null)
    try {
      const { resume, droppedClaims } = await resumeApi.upload(file)
      // the AI never sees contact details, so keep the ones already typed in
      setDoc((current) => ({ ...resume, contact: current?.contact?.name ? current.contact : resume.contact }))
      setOrigin({ kind: 'upload', fileName: file.name, droppedClaims, replaced: saved })
      setDirty(true)
      setSuggestions([])
      setCoachNote(null)
      setPhase('ready')
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    const { resume } = await resumeApi.save(doc)
    setDoc(resume)
    setSaved(true)
    setDirty(false)
    setOrigin({ kind: 'saved' })
    return resume
  }

  const act = (name, work) => async () => {
    setBusy(name)
    setError(null)
    try {
      await work()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
    }
  }

  const improve = act('improving', async () => {
    setCoachNote(null)
    if (!coachLines(doc, section).length) {
      setSuggestions([])
      setCoachNote('Add a summary or a few points under experience or projects first. Those are the lines Raven rewrites.')
      return
    }
    const slug = toSlug(company)
    const { suggestions: found } = await resumeApi.improve({ resume: doc, ...(section ? { section } : {}), ...(slug ? { company: slug } : {}) })
    setSuggestions(found)
    if (!found.length) setCoachNote("Raven didn't find lines worth rewriting. Add more detail to your points, or try another section.")
  })

  const pdf = act('pdf', async () => {
    if (dirty || !saved) await save()
    download(await resumeApi.pdf())
  })

  const accept = (s) => {
    set(s.path, s.after)
    setSuggestions((all) => all.filter((x) => x.path !== s.path))
  }
  const skip = (s) => setSuggestions((all) => all.filter((x) => x.path !== s.path))

  if (phase === 'loading') return <div className="db__panel"><p className="db__muted">Loading your resume…</p></div>
  if (phase === 'failed') return <div className="db__panel"><Problem error={loadError} onRetry={reload} /></div>

  if (phase === 'start') {
    return (
      <div className="db__panel">
        <p className="db__intro">
          Upload your resume and Raven will lay it out here, then suggest sharper wording for {defaultRole ? `${defaultRole} roles` : 'the roles you want'}. It only
          rewrites what your resume already says and never makes up numbers.
        </p>
        {busy === 'reading' ? <Thinking>Raven is reading your resume…</Thinking> : <FilePicker busy={!!busy} onFile={read} />}
        <Problem error={error} />
        <button type="button" className="db__link db__start" onClick={() => (setOrigin({ kind: 'profile' }), setPhase('ready'))}>No resume yet? Start from your profile</button>
      </div>
    )
  }

  const blanks = coachLines(doc).filter((line) => line.includes(ADD_NUMBER)).length
  const working = !!busy

  return (
    <div className="db__panel">
      {origin?.kind === 'upload' && (
        <div className="rs__note">
          <p>
            Read from <strong>{origin.fileName}</strong>. Check it, then save. Nothing is kept until you do.
            {origin.droppedClaims > 0 && ` Raven left out ${origin.droppedClaims} skill${origin.droppedClaims === 1 ? '' : 's'} it couldn't point to in the file.`}
          </p>
          {origin.replaced && <button type="button" className="db__link" onClick={reload}>Go back to my saved resume</button>}
        </div>
      )}
      {origin?.kind === 'onboarding' && (
        <div className="rs__note">
          <p>Built from <strong>{origin.fileName}</strong>, the resume you uploaded when you signed up. Check it and save it.</p>
        </div>
      )}
      {origin?.kind === 'profile' && (
        <div className="rs__note"><p>Built from your profile. Fill in what's missing and save it.</p></div>
      )}

      <section className="rs__coach" aria-label="Improve with Raven">
        <div>
          <h3 className="db__h3">Improve with Raven</h3>
          <p className="db__muted">
            Rewrites your summary and points to be specific and results-focused{defaultRole ? ` for ${defaultRole} roles` : ''}. It works on what's on screen, saved or not.
          </p>
        </div>
        <div className="db__pair">
          <label className="ob__field">
            <span>What to review</span>
            <select value={section} onChange={(e) => setSection(e.target.value)}>
              {SECTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <Field label="Applying to (optional)" value={company} onChange={setCompany} placeholder="e.g. ATB Financial" maxLength={100} />
        </div>
        <button type="button" className="ob__next db__start" onClick={improve} disabled={working}>
          {busy === 'improving' ? 'Raven is reading your resume…' : 'Improve with Raven'}
        </button>
      </section>

      {busy === 'improving' && <Thinking>Raven is rewriting your lines…</Thinking>}
      <Suggestions items={suggestions} doc={doc} onAccept={accept} onSkip={skip} />
      {coachNote && <p className="db__muted">{coachNote}</p>}
      {blanks > 0 && (
        <p className="rs__warn">
          {blanks} line{blanks === 1 ? ' has' : 's have'} <mark className="rs__blank">{ADD_NUMBER}</mark>. Put in the real figure, or reword it, before you send this resume.
        </p>
      )}
      <Problem error={error} />

      {busy === 'reading' ? (
        <Thinking>Raven is reading your resume…</Thinking>
      ) : (
        <fieldset className="rs__editor" disabled={busy === 'saving' || busy === 'pdf'}>
          <Editor doc={doc} set={set} />
        </fieldset>
      )}

      <div className="rs__bar">
        <button type="button" className="ob__next" onClick={act('saving', save)} disabled={working || (saved && !dirty)}>
          {busy === 'saving' ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="db__ghost" onClick={pdf} disabled={working}>
          {busy === 'pdf' ? 'Preparing PDF…' : dirty || !saved ? 'Save and download PDF' : 'Download PDF'}
        </button>
        <span className="db__muted">
          {dirty || !saved ? 'Unsaved changes' : doc.updatedAt ? `Saved ${new Date(doc.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'Saved'}
        </span>
        <FilePicker busy={working} onFile={read}>Upload a different resume</FilePicker>
      </div>
    </div>
  )
}
