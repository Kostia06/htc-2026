import { useEffect, useState } from 'react'
import { memories as memoryApi } from '../lib/agent'
import { supabase } from '../lib/supabase'
import { InterviewPrep, Practice } from './Interview'
import Plan from './Plan'
import Recommendations from './Recommendations'
import ResumeBuilder from './Resume'
import { pruneResults } from './useSkill'
import { Problem } from './ui'
import '../onboarding/onboarding.css'
import './dashboard.css'

const list = (v) => (Array.isArray(v) ? v : v ? [v] : [])
const realRoles = (answers) => list(answers.roles).filter((r) => r !== 'Not sure yet')
const isStudent = (answers) => ['High school', 'University or college'].includes(answers.stage)

const KINDS = { goal: 'Goals', skill: 'Strengths', weakness: 'Working on', preference: 'Preferences', note: 'Notes' }

/** What the agents have remembered about this person, encrypted on the server. They can see and delete every item. */
function Memory() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)

  const load = () => memoryApi.list().then((all) => (setItems(all), setError(null)), setError)
  useEffect(() => {
    load()
  }, [])

  const forget = async (id) => {
    try {
      await memoryApi.forget(id)
      setItems((all) => all.filter((m) => m.id !== id))
    } catch (e) {
      setError(e)
    }
  }

  const groups = Object.keys(KINDS)
    .map((kind) => [kind, (items ?? []).filter((m) => m.kind === kind)])
    .filter(([, group]) => group.length)

  return (
    <div className="db__panel">
      <p className="db__intro">What Raven's agents have learned from your profile and practice sessions, used to tailor questions and plans. It's stored encrypted, and you can delete anything.</p>
      <Problem error={error} onRetry={load} />
      {items === null && !error && <p className="db__muted">Loading…</p>}
      {items?.length === 0 && <p className="db__muted">Nothing yet. Practise an interview and Raven will note what to work on.</p>}
      {groups.map(([kind, group]) => (
        <section key={kind}>
          <h3 className="db__h3">{KINDS[kind]}</h3>
          <ul className="db__memories">
            {group.map((m) => (
              <li key={m.id}>
                <span>{m.text}</span>
                <button type="button" className="db__link" onClick={() => forget(m.id)} aria-label={`Forget: ${m.text}`}>Forget</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Profile({ answers, syncProblem, onRedo }) {
  const rows = [
    ['Now', answers.stage],
    ['Studying', [answers.school?.school, answers.school?.program].filter(Boolean).join(', ')],
    ['Target roles', list(answers.roles).join(', ')],
    ['Search so far', answers.situation],
    ['Skills', list(answers.skills).join(', ')],
    ['Looking in', answers.where],
    ['Time per week', answers.time],
    ['Resume', answers.resume?.fileName],
  ].filter(([, v]) => v)

  return (
    <div className="db__panel">
      {syncProblem && <p className="db__problem">Your answers are saved on this device, but not on the server yet: {syncProblem}. Use "Edit my answers" to try again.</p>}
      <dl className="account__answers">
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <div className="db__row">
        <button type="button" className="db__ghost" onClick={onRedo}>Edit my answers</button>
        <button type="button" className="db__ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  )
}

export default function Dashboard({ session, answers, syncProblem, onRedo }) {
  const userId = session.user.id
  const stamp = answers.completedAt ?? 'answers'
  const first = session.user.user_metadata?.full_name?.split(' ')[0]
  const roles = realRoles(answers)
  const role = roles[0] ?? ''
  const [tab, setTab] = useState('plan')
  const [visited, setVisited] = useState(() => new Set(['plan']))
  const [practicePreset, setPracticePreset] = useState(null)

  useEffect(() => pruneResults(userId, stamp), [userId, stamp])

  const go = (id) => {
    setTab(id)
    setVisited((v) => (v.has(id) ? v : new Set(v).add(id)))
  }

  const tabs = [
    { id: 'plan', label: 'Plan', title: 'Your plan', bare: true, render: () => <Plan userId={userId} stamp={stamp} first={first} role={role} onGo={go} /> },
    { id: 'resume', label: 'Resume', title: 'Your resume', render: () => <ResumeBuilder answers={answers} defaultRole={role} /> },
    {
      id: 'jobs',
      label: 'Jobs',
      title: 'Jobs for you',
      bare: true,
      render: () => (
        <Recommendations
          userId={userId}
          stamp={stamp}
          skill="recommend-jobs"
          field="query"
          heading="Jobs, labelled honestly."
          label="What kind of role?"
          placeholder="e.g. junior data analyst in Calgary"
          initial={[roles.join(' or '), answers.where].filter(Boolean).join(', ') || undefined}
          intro="Real postings, each checked against your profile. Every requirement is quoted from the posting, so you can see exactly why it got its label."
          empty="No postings Raven could check came up. Try a broader search."
          onPractise={(title) => {
            setPracticePreset({ role: title, key: Date.now() })
            go('practice')
          }}
        />
      ),
    },
    {
      id: 'courses',
      label: 'Courses',
      title: 'Courses',
      student: true,
      bare: true,
      render: () => (
        <Recommendations
          userId={userId}
          stamp={stamp}
          skill="recommend-courses"
          field="interest"
          heading="Courses that move you forward."
          label="What do you want to learn?"
          placeholder="e.g. machine learning"
          initial={answers.school?.program || role || undefined}
          intro="University of Calgary courses for your goals, checked against their prerequisites and antirequisites."
          empty="No courses Raven could check came up. Try another topic."
        />
      ),
    },
    {
      id: 'research',
      label: 'Research',
      title: 'Research opportunities',
      student: true,
      bare: true,
      render: () => (
        <Recommendations
          userId={userId}
          stamp={stamp}
          skill="recommend-research"
          field="interest"
          heading="Research you could join."
          label="What research area?"
          placeholder="e.g. human-computer interaction"
          initial={answers.school?.program || undefined}
          intro="Undergraduate research routes at the University of Calgary: UREX, USRA and labs that take students."
          empty="Nothing Raven could check came up. Try another area."
        />
      ),
    },
    {
      id: 'prep',
      label: 'Interview prep',
      title: 'Interview prep',
      render: () => (
        <InterviewPrep
          userId={userId}
          stamp={stamp}
          defaultRole={role}
          onPractice={(preset) => {
            setPracticePreset({ ...preset, key: Date.now() })
            go('practice')
          }}
        />
      ),
    },
    {
      id: 'practice',
      label: 'Practice',
      title: 'Mock interview',
      render: () => <Practice key={practicePreset?.key ?? 'practice'} defaultRole={role} preset={practicePreset} />,
    },
    { id: 'memory', label: 'What Raven knows', title: 'What Raven knows about you', render: () => <Memory /> },
    { id: 'profile', label: 'Profile', title: 'Your answers', render: () => <Profile answers={answers} syncProblem={syncProblem} onRedo={onRedo} /> },
  ]
  // course and research picks are UCalgary-specific, so they lead for students and stay reachable for everyone
  const ordered = isStudent(answers) ? tabs : [...tabs.filter((t) => !t.student), ...tabs.filter((t) => t.student)]

  const initial = (first ?? session.user.email ?? '?').charAt(0).toUpperCase()

  return (
    <div className="db">
      <header className="db__bar">
        <span className="db__logo">raven</span>
        <nav className="db__nav" aria-label="Sections">
          {ordered.map((t) => (
            <button key={t.id} type="button" className={`db__tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <button type="button" className="db__avatar" onClick={() => go('profile')} aria-label="Your profile">{initial}</button>
      </header>

      <main className="db__main">
        {/* visited panels stay mounted (hidden) so a run in progress isn't lost when switching tabs */}
        {ordered.filter((t) => visited.has(t.id)).map((t) => (
          <section key={t.id} className={`db__section${t.bare ? ' db__section--bare' : ''}`} hidden={tab !== t.id} aria-label={t.title}>
            {!t.bare && <h2 className="db__h2">{t.title}</h2>}
            {t.render()}
          </section>
        ))}
      </main>
    </div>
  )
}
