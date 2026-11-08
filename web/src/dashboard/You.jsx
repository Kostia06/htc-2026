import { useEffect, useState } from 'react'
import { memories as memoryApi } from '../lib/agent'
import { supabase } from '../lib/supabase'
import { PageHead, Problem } from './ui'
import './you.css'

const list = (v) => (Array.isArray(v) ? v : v ? [v] : [])
const KINDS = { goal: 'Goals', skill: 'Strengths', weakness: 'Working on', preference: 'Preferences', note: 'Notes' }

/** What the agents have remembered about this person, encrypted on the server. They can see and delete every item. */
function Memory({ onGo }) {
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
    <section className="pg__side pg__card yu__knows" aria-labelledby="yu-knows">
      <h2 id="yu-knows">What Raven knows</h2>
      <p className="pg__muted">What Raven's agents learn from your profile and practice sessions, used to tailor your plan and questions. Stored encrypted, and you can delete anything.</p>
      <Problem error={error} onRetry={load} />
      {items === null && !error && <p className="pg__label">Loading…</p>}
      {items?.length === 0 && (
        <div className="pg__card pg__card--dashed yu__empty">
          <span>Nothing yet.</span>
          <p className="pg__muted">Practise an interview and Raven will note what to work on.</p>
          <button type="button" className="db__ghost" onClick={() => onGo('practice')}>Start a practice</button>
        </div>
      )}
      {groups.map(([kind, group]) => (
        <div key={kind} className="yu__group">
          <span className="pg__label">{KINDS[kind]}</span>
          <ul className="yu__memories">
            {group.map((m) => (
              <li key={m.id}>
                <span>{m.text}</span>
                <button type="button" className="db__link" onClick={() => forget(m.id)} aria-label={`Forget: ${m.text}`}>Forget</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

export default function You({ name, role, answers, syncProblem, onRedo, onGo }) {
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
    <div className="pg">
      <PageHead eyebrow={role ? `On the way to ${role}` : 'Your profile'} title={name || 'You'}>
        <button type="button" className="yu__out" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </PageHead>

      {syncProblem && <p className="db__problem">Your answers are saved on this device, but not on the server yet: {syncProblem}. Use "Edit" to try again.</p>}

      <div className="pg__grid">
        <section className="pg__main pg__card yu__answers" aria-labelledby="yu-answers">
          <div className="yu__head">
            <h2 id="yu-answers">Your answers</h2>
            <button type="button" className="db__ghost" onClick={onRedo}>Edit</button>
          </div>
          <dl>
            {rows.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </section>

        <Memory onGo={onGo} />
      </div>

      <section className="yu__more" aria-labelledby="yu-more">
        <h2 id="yu-more" className="pg__h2">Grow your skills</h2>
        <button type="button" onClick={() => onGo('courses')}>
          <span><span>Courses</span><span>University of Calgary courses for your goals, checked against prerequisites.</span></span>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" onClick={() => onGo('research')}>
          <span><span>Research opportunities</span><span>UREX, USRA and labs that take undergraduate students.</span></span>
          <span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  )
}
