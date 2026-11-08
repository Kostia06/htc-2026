import { useEffect, useState } from 'react'
import { memories as memoryApi } from '../lib/agent'
import { supabase } from '../lib/supabase'
import { InterviewPrep, Practice } from './Interview'
import Recommendations from './Recommendations'
import { pruneResults, useSkill } from './useSkill'
import { Problem, Steps, Thinking, Updated } from './ui'
import '../onboarding/onboarding.css'
import './dashboard.css'

const list = (v) => (Array.isArray(v) ? v : v ? [v] : [])
const realRoles = (answers) => list(answers.roles).filter((r) => r !== 'Not sure yet')
const isStudent = (answers) => ['High school', 'University or college'].includes(answers.stage)

/** career-snapshot: the first thing someone sees after onboarding, run automatically from the profile they just saved. */
function Plan({ userId, stamp, onGo }) {
  const [state, run] = useSkill({ userId, stamp, key: 'career-snapshot', skill: 'career-snapshot', auto: true })
  const busy = state.status === 'loading'
  const output = state.output

  return (
    <div className="db__panel">
      {busy && !output && <Thinking>Raven is reading your profile and building your plan…</Thinking>}
      <Problem error={state.status === 'error' && state.error} onRetry={() => run()} />
      {output && (
        <>
          <h3 className="db__h3">Roles to aim for</h3>
          <div className="db__chips">
            {output.targetRoles?.map((r) => <span key={r} className="db__chip db__chip--strong">{r}</span>)}
          </div>
          <h3 className="db__h3">Your next steps</h3>
          <Steps items={output.nextSteps} />
          <Updated at={state.at} onRefresh={() => run()} busy={busy} />
          {busy && <Thinking>Refreshing your plan…</Thinking>}
        </>
      )}
      <div className="db__shortcuts">
        <button type="button" onClick={() => onGo('jobs')}><strong>Jobs you could apply for</strong><span>Real postings, checked against your profile</span></button>
        <button type="button" onClick={() => onGo('prep')}><strong>Prepare for an interview</strong><span>Questions candidates were asked</span></button>
        <button type="button" onClick={() => onGo('practice')}><strong>Practise an interview</strong><span>Scored answers and a debrief</span></button>
      </div>
    </div>
  )
}

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
    { id: 'plan', label: 'Your plan', title: 'Your plan', render: () => <Plan userId={userId} stamp={stamp} onGo={go} /> },
    {
      id: 'jobs',
      label: 'Jobs',
      title: 'Jobs for you',
      render: () => (
        <Recommendations
          userId={userId}
          stamp={stamp}
          skill="recommend-jobs"
          field="query"
          label="What kind of role?"
          placeholder="e.g. junior data analyst in Calgary"
          initial={[roles.join(' or '), answers.where].filter(Boolean).join(', ') || undefined}
          intro="Real postings, each labelled honestly: ready now, stretch, long term, or can't tell yet. Every requirement is quoted from the posting and checked against your profile."
          empty="No postings Raven could check came up. Try a broader search."
        />
      ),
    },
    {
      id: 'courses',
      label: 'Courses',
      title: 'Courses',
      student: true,
      render: () => (
        <Recommendations
          userId={userId}
          stamp={stamp}
          skill="recommend-courses"
          field="interest"
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
      render: () => (
        <Recommendations
          userId={userId}
          stamp={stamp}
          skill="recommend-research"
          field="interest"
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

  return (
    <main className="db">
      <header className="db__header">
        <div>
          <p className="db__muted">{role ? `On the way to ${role}` : 'Your career plan'}</p>
          <h1 className="db__title">{first ? `Welcome, ${first}` : 'Welcome'}</h1>
        </div>
        <button type="button" className="db__ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      <nav className="db__tabs" aria-label="Sections">
        {ordered.map((t) => (
          <button key={t.id} type="button" className={`db__tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* visited panels stay mounted (hidden) so a run in progress isn't lost when switching tabs */}
      {ordered.filter((t) => visited.has(t.id)).map((t) => (
        <section key={t.id} className="db__section" hidden={tab !== t.id} aria-label={t.title}>
          <h2 className="db__h2">{t.title}</h2>
          {t.render()}
        </section>
      ))}
    </main>
  )
}
