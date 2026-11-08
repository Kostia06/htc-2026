import { useEffect, useState } from 'react'
import Interview from './Interview'
import Plan from './Plan'
import Recommendations from './Recommendations'
import ResumeBuilder from './Resume'
import { pruneResults } from './useSkill'
import You from './You'
import '../onboarding/onboarding.css'
import './dashboard.css'

const list = (v) => (Array.isArray(v) ? v : v ? [v] : [])
const realRoles = (answers) => list(answers.roles).filter((r) => r !== 'Not sure yet')
const isStudent = (answers) => ['High school', 'University or college'].includes(answers.stage)

export default function Dashboard({ session, answers, syncProblem, onRedo }) {
  const userId = session.user.id
  const stamp = answers.completedAt ?? 'answers'
  const fullName = session.user.user_metadata?.full_name
  const first = fullName?.split(' ')[0]
  const roles = realRoles(answers)
  const role = roles[0] ?? ''
  const [tab, setTab] = useState('plan')
  const [visited, setVisited] = useState(() => new Set(['plan']))
  const [practicePreset, setPracticePreset] = useState(null)
  const [interviewMode, setInterviewMode] = useState('mock')

  useEffect(() => pruneResults(userId, stamp), [userId, stamp])

  const go = (target) => {
    // prep and practice are two modes of the one interview page
    const id = target === 'prep' || target === 'practice' ? 'interview' : target
    if (id !== target) setInterviewMode(target === 'prep' ? 'prep' : 'mock')
    setTab(id)
    setVisited((v) => (v.has(id) ? v : new Set(v).add(id)))
  }

  const tabs = [
    { id: 'plan', label: 'Plan', title: 'Your plan', render: () => <Plan userId={userId} stamp={stamp} first={first} role={role} onGo={go} /> },
    { id: 'resume', label: 'Resume', title: 'Your resume', render: () => <ResumeBuilder answers={answers} defaultRole={role} /> },
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
          heading="Jobs, labelled honestly."
          label="What kind of role?"
          placeholder="e.g. junior data analyst in Calgary"
          initial={[roles.join(' or '), answers.where].filter(Boolean).join(', ') || undefined}
          intro="Real postings, each checked against your profile. Every requirement is quoted from the posting, so you can see exactly why it got its label."
          empty="No postings Skillit could check came up. Try a broader search."
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
          empty="No courses Skillit could check came up. Try another topic."
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
          heading="Research you could join."
          label="What research area?"
          placeholder="e.g. human-computer interaction"
          initial={answers.school?.program || undefined}
          intro="Undergraduate research routes at the University of Calgary: UREX, USRA and labs that take students."
          empty="Nothing Skillit could check came up. Try another area."
        />
      ),
    },
    {
      id: 'interview',
      label: 'Interview',
      title: 'Interview',
     
      render: () => (
        <Interview
          mode={interviewMode}
          onMode={setInterviewMode}
          userId={userId}
          stamp={stamp}
          defaultRole={role}
          preset={practicePreset}
          onPractice={(preset) => {
            setPracticePreset({ ...preset, key: Date.now() })
            go('practice')
          }}
        />
      ),
    },
    {
      id: 'you',
      label: 'You',
      title: 'You',
     
      render: () => <You name={fullName || first} role={role} answers={answers} syncProblem={syncProblem} onRedo={onRedo} onGo={go} />,
    },
  ]
  // the design's order: Plan, Jobs, Interview, Resume, You. Course and research picks are UCalgary-specific, so they
  // sit in the nav for students and are reached from the You page for everyone else
  const order = ['plan', 'jobs', 'courses', 'research', 'interview', 'resume', 'you']
  const ordered = order.map((id) => tabs.find((t) => t.id === id))
  const inNav = ordered.filter((t) => !t.student || isStudent(answers))
  const navOn = (id) => id === tab || (id === 'you' && !inNav.some((t) => t.id === tab))

  const initial = (first ?? session.user.email ?? '?').charAt(0).toUpperCase()

  return (
    <div className="db">
      <header className="db__bar">
        <span className="db__logo">skillit</span>
        <nav className="db__nav" aria-label="Sections">
          {inNav.map((t) => (
            <button key={t.id} type="button" className={`db__tab${navOn(t.id) ? ' is-on' : ''}`} aria-current={navOn(t.id) ? 'page' : undefined} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <button type="button" className="db__avatar" onClick={() => go('you')} aria-label="Your profile">{initial}</button>
      </header>

      <main className="db__main">
        {/* visited panels stay mounted (hidden) so a run in progress isn't lost when switching tabs */}
        {ordered.filter((t) => visited.has(t.id)).map((t) => (
          <section key={t.id} className="db__section" hidden={tab !== t.id} aria-label={t.title}>
            {t.render()}
          </section>
        ))}
      </main>
    </div>
  )
}
