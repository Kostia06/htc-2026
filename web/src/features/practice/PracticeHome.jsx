// PracticeView.swift: an optional company or role, how hard the interviewer pushes, the interview card, and the
// ways in to VR, telling Skillit about a real interview, and past sessions.
import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { ChartLine, Glasses, MessagesSquare, UserRoundSearch, Zap } from 'lucide-react'
import { readPref, writePref } from '../../lib/cache'
import { Segmented } from '../../ui/Controls'
import { NavRow, Page, PageHeader } from '../../ui/Layout'
import { DIFFICULTIES } from './difficulty'
import NearbyJobs from './NearbyJobs'
import './practice.css'

export default function PracticeHome() {
  const navigate = useNavigate()
  const [role, setRole] = useState('')
  const [difficulty, setDifficulty] = useState(() => readPref('practiceDifficulty', 'standard'))
  const note = DIFFICULTIES.find((d) => d.id === difficulty)?.note

  const pick = (id) => {
    setDifficulty(id)
    writePref('practiceDifficulty', id)
  }

  const start = ({ quick = false, posting } = {}) => {
    const params = new URLSearchParams({ difficulty })
    // a real posting: the interviewer tests you on its own description
    if (posting) params.set('posting', posting)
    if (quick) params.set('length', 'quick')
    // nothing picked: the server opens with the profile's first target role
    if (!posting && role.trim()) params.set('role', role.trim())
    navigate(`/practice/session?${params}`)
  }

  return (
    <Page className="practice">
      <PageHeader title="Practice" large />
      <div className="practice__stack">
        {/* what this interview is for; real postings near you are listed below */}
        <div className="practice__target">
          <p className="t-subhead c-2">You're practising for</p>
          <p className="t-title3">{role.trim() || 'A general interview'}</p>
        </div>

        <div className="card practice__field">
          <input
            className="practice__input t-body"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Company or role (optional)"
            aria-label="Company or role (optional)"
            onKeyDown={(e) => e.key === 'Enter' && start()}
          />
        </div>

        <NearbyJobs onPractise={(posting) => start({ posting })} />

        <div className="practice__difficulty">
          <Segmented label="Difficulty" options={DIFFICULTIES} value={difficulty} onChange={pick} />
          <p className="t-footnote c-2" key={difficulty}>
            {note}
          </p>
        </div>

        <button type="button" className="card interview-card interview-card--quick" onClick={() => start({ quick: true })}>
          <Zap size={30} strokeWidth={2} className="interview-card__icon" aria-hidden />
          <span className="stack interview-card__text">
            <span className="t-title2">Quick interview · 1 min</span>
            <span className="t-subhead">Two questions, no follow-ups. A taste of the real thing.</span>
          </span>
        </button>

        <button type="button" className="card interview-card" onClick={() => start()}>
          <UserRoundSearch size={30} strokeWidth={2} className="c-action interview-card__icon" aria-hidden />
          <span className="stack interview-card__text">
            <span className="t-title2">Interview</span>
            <span className="t-subhead c-2">Answer the questions a hiring manager would ask, out loud.</span>
          </span>
        </button>

        <div className="practice__links">
          <NavRow icon={Glasses} label="Practice in VR" to="/practice/vr" />
          <NavRow icon={MessagesSquare} label="Tell Skillit about a real interview" to="/practice/recap" />
          <NavRow icon={ChartLine} label="Past sessions" to="/practice/history" />
        </div>
      </div>
      <Outlet />
    </Page>
  )
}
