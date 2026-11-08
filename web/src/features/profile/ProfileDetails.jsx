// SkillsAndExperienceView.swift at /profile/details: target roles, skills, experience and education, each edited
// in place. The forms and the skills editor open over it as child routes.
import { useState } from 'react'
import { Outlet } from 'react-router'
import { CircleCheck, CirclePlus, Pencil, Plus, X } from 'lucide-react'
import { Flash, SkeletonLines } from '../../ui/Feedback'
import { Group, GroupRow, Page, PageHeader } from '../../ui/Layout'
import GithubConnect from '../connections/GithubConnect'
import LinkedinReview from '../connections/LinkedinReview'
import { useProfileEdit } from './useProfile'
import './profile.css'

const SKILLS_SHOWN = 8

export default function ProfileDetails() {
  const { profile, loading, edit, flash, clearFlash } = useProfileEdit()
  return (
    <Page className="profile">
      <PageHeader title="Skills & experience" back={{ to: '/profile', label: 'Profile' }} />
      <div className="stack profile__stack">
        {loading ? (
          <Group header="Target roles">
            <GroupRow>
              <SkeletonLines widths={[0.6, 0.8, 0.4]} highlighted={1} />
            </GroupRow>
          </Group>
        ) : (
          <>
            <Group header="Target roles" footer="The first one leads your profile and shapes your road.">
              <GroupRow>
                <ChipsEditor
                  items={profile.targetRoles}
                  placeholder="Add a role you're aiming for"
                  onAdd={(text) => edit({ type: 'addRole', text })}
                  onRemove={(text) => edit({ type: 'removeRole', text })}
                />
              </GroupRow>
            </Group>

            <Group header="Skills">
              <GroupRow>
                <Skills skills={profile.skills} onRemove={(name) => edit({ type: 'removeSkill', name })} />
              </GroupRow>
              <GroupRow to="/profile/details/skills" chevron={false}>
                <span className="row t-subhead semibold c-action profile__add">
                  <Pencil size={15} strokeWidth={2.4} aria-hidden /> Edit skills
                </span>
              </GroupRow>
            </Group>

            <Group header="Experience">
              {profile.experience.map((e, i) => (
                <GroupRow key={`${e.role}-${e.org}-${i}`} to={`/profile/details/experience/${i}`}>
                  <span className="t-headline">{e.role}</span>
                  <span className="t-subhead c-2">{e.org}</span>
                  {(e.start || e.end) && <span className="t-caption c-2">{[e.start, e.end || 'Present'].filter(Boolean).join(' – ')}</span>}
                </GroupRow>
              ))}
              <AddRow to="/profile/details/experience/new">Add experience</AddRow>
            </Group>

            <Group header="Education">
              {profile.education.map((e, i) => (
                <GroupRow key={`${e.school}-${i}`} to={`/profile/details/education/${i}`}>
                  <span className="t-headline">{e.school}</span>
                  {(e.program || e.year || e.expectedGraduation) && (
                    <span className="t-subhead c-2">
                      {[e.program, e.year, e.expectedGraduation && `Graduating ${e.expectedGraduation}`].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </GroupRow>
              ))}
              <AddRow to="/profile/details/education/new">Add education</AddRow>
            </Group>

            <Group header="Connected accounts">
              <GroupRow>
                <GithubConnect />
              </GroupRow>
            </Group>

            <Group header="Review my LinkedIn">
              <GroupRow>
                <LinkedinReview />
              </GroupRow>
            </Group>
          </>
        )}
      </div>
      <Flash message={flash?.message} tone={flash?.tone} icon={flash?.tone === 'positive' ? CircleCheck : undefined} duration={flash?.tone === 'negative' ? 3000 : 1400} onDone={clearFlash} />
      <Outlet context={{ profile, edit }} />
    </Page>
  )
}

function AddRow({ to, children }) {
  return (
    <GroupRow to={to} chevron={false}>
      <span className="row t-subhead semibold c-action profile__add">
        <Plus size={17} strokeWidth={2.6} aria-hidden /> {children}
      </span>
    </GroupRow>
  )
}

function ChipsEditor({ items, placeholder, onAdd, onRemove }) {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const add = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onAdd(text)
    setText('')
  }
  return (
    <div className="stack chips-editor">
      {items.length > 0 && (
        <div className="chips-editor__chips">
          {items.map((item) => (
            <span key={item} className="edit-chip t-subhead medium">
              {item}
              <button type="button" onClick={() => onRemove(item)} aria-label={`Remove ${item}`}>
                <X size={13} strokeWidth={3} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <form className="row chips-editor__add" onSubmit={add}>
        <CirclePlus size={20} strokeWidth={2.2} className={focused ? 'c-action' : 'c-2'} aria-hidden />
        <input
          className="grow chips-editor__input t-body"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label={placeholder}
        />
        {text.trim() && (
          <button type="submit" className="t-headline c-action">
            Add
          </button>
        )}
      </form>
    </div>
  )
}

function Skills({ skills, onRemove }) {
  const [all, setAll] = useState(false)
  if (!skills.length) return <p className="t-subhead c-2">Skillit picks these up from your resume and practice, or add your own.</p>
  const shown = all ? skills : skills.slice(0, SKILLS_SHOWN)
  return (
    <div className="stack chips-editor">
      <div className="chips-editor__chips">
        {shown.map((s) => (
          <span key={s.name} className="edit-chip edit-chip--plain t-subhead" title={s.evidence ?? undefined}>
            {s.name}
            <button type="button" onClick={() => onRemove(s.name)} aria-label={`Remove ${s.name}`}>
              <X size={12} strokeWidth={3} aria-hidden />
            </button>
          </span>
        ))}
      </div>
      {skills.length > SKILLS_SHOWN && (
        <button type="button" className="t-subhead semibold c-action skills__more" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${skills.length}`}
        </button>
      )}
    </div>
  )
}
