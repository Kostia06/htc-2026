// ProfileView.swift: kept short on purpose. Who you are and how far along the road you are, the one thing worth
// doing next, then four doors. Every editor lives one click behind a door; settings sit behind the gear.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CircleCheck, CornerDownRight, FileText, Glasses, ListChecks, Pencil, Settings, Signpost } from 'lucide-react'
import { Flash, ThinProgressBar } from '../../ui/Feedback'
import { BarButton, Page, PageHeader } from '../../ui/Layout'
import { describeMove, pickNextMove } from './nextMove'
import { useProfileEdit, useProfileOverview } from './useProfile'
import './profile.css'
import './you.css'

const plural = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`

export default function Profile() {
  const navigate = useNavigate()
  const { profile, edit, flash, clearFlash } = useProfileEdit()
  const overview = useProfileOverview()
  // until the resumes are in, only "choose a role" is certain; anything else might flip a second later
  const move = overview.loaded || !profile.targetRoles.length ? pickNextMove({ profile, ...overview }) : null
  const doors = [
    { to: '/resume', title: 'Resume', icon: FileText, fact: overview.tailored.length ? `Base + ${overview.tailored.length} tailored` : 'Base resume' },
    { to: '/profile/details', title: 'Skills & experience', icon: ListChecks, fact: `${plural(profile.skills.length, 'skill')} · ${plural(profile.experience.length, 'job')}` },
    { to: '/settings/memory', title: 'Crossroads', icon: Signpost, fact: 'What Skillit remembers' },
    { to: '/profile/headsets', title: 'Headsets', icon: Glasses, fact: overview.headsets == null ? 'Practice in VR' : overview.headsets ? `${overview.headsets} paired` : 'None paired yet' },
  ]

  return (
    <Page className="profile">
      <PageHeader title="Profile" large actions={<BarButton icon={Settings} label="Settings" onClick={() => navigate('/settings')} />} />
      <div className="stack you">
        <section className="stack you__identity">
          <ProfileHeader profile={profile} onHeadline={(text) => edit({ type: 'headline', text })} />
          {overview.road?.total > 0 && <RoadProgress road={overview.road} />}
        </section>
        {move && <NextMove move={move} />}
        <nav className="you__doors" aria-label="Your profile">
          {doors.map(({ to, title, icon: Icon, fact }) => (
            <Link key={to} to={to} className="card you-door">
              <Icon size={26} strokeWidth={1.8} className="c-action" aria-hidden />
              <span className="you-door__text">
                <span className="t-headline">{title}</span>
                <span className="t-subhead c-2">{fact}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
      <Flash message={flash?.message} tone={flash?.tone} icon={flash?.tone === 'positive' ? CircleCheck : undefined} duration={flash?.tone === 'negative' ? 3000 : 1400} onDone={clearFlash} />
    </Page>
  )
}

function RoadProgress({ road }) {
  const steps = `${road.done} of ${road.total} steps on your road`
  return (
    <div className="stack you__road">
      <p className="t-subhead c-2">{road.streakDays > 1 ? `${steps} · ${road.streakDays}-day streak` : steps}</p>
      <ThinProgressBar value={road.done / road.total} tint="var(--positive)" label="Road progress" />
    </div>
  )
}

/** Sand marks it as Skillit's idea; its button is the only sage on the page, so the eye lands there first. */
function NextMove({ move }) {
  const { title, detail, button, to } = describeMove(move)
  return (
    <section className="card next-move" aria-labelledby="next-move-title">
      <p className="row t-subhead semibold c-agent next-move__eyebrow">
        <CornerDownRight size={16} strokeWidth={2.4} aria-hidden /> Next move
      </p>
      <h2 id="next-move-title" className="t-title3">
        {title}
      </h2>
      <p className="t-subhead c-2">{detail}</p>
      <Link to={to} className="raised-btn next-move__button" style={{ '--face': 'var(--action)', '--fg': 'var(--on-action)' }}>
        <span className="raised-btn__face">{button}</span>
      </Link>
    </section>
  )
}

function ProfileHeader({ profile, onHeadline }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const role = profile.targetRoles[0]
  const commit = () => {
    setEditing(false)
    onHeadline(text)
  }
  return (
    <header className="profile-header">
      <p className="t-subhead c-2">{role ? 'Aiming for' : 'Your profile'}</p>
      <h2 className="profile-header__role rounded-num">{role ?? "Set the role you're aiming for"}</h2>
      {editing ? (
        <input
          className="field profile-header__input"
          value={text}
          autoFocus
          placeholder="One line about you"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          aria-label="One line about you"
        />
      ) : (
        <button
          type="button"
          className={`profile-header__headline t-body ${profile.headline ? 'c-2' : 'c-action'}`}
          onClick={() => {
            setText(profile.headline ?? '')
            setEditing(true)
          }}
        >
          {profile.headline || 'Add a line about yourself'}
          <Pencil size={13} strokeWidth={2.4} className="c-3" aria-hidden />
        </button>
      )}
    </header>
  )
}
