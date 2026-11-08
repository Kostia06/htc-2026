// ProfileView.swift: who you're aiming to be, your resume, target roles, skills, experience and education.
// Every edit shows at once and saves in the background; a refused save puts the server's copy back.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { CircleCheck, FileText, Pencil, Plus, CirclePlus, Settings, X } from 'lucide-react'
import { normalizeProfile, useApp } from '../../app/context'
import { profileApi, resumeApi } from '../../lib/client'
import { relative } from '../../lib/format'
import { Flash, SkeletonLines } from '../../ui/Feedback'
import { BarButton, Group, GroupRow, Page, PageHeader } from '../../ui/Layout'
import { applyEdit } from './edits'
import './profile.css'

const SKILLS_SHOWN = 8

export default function Profile() {
  const app = useApp()
  const navigate = useNavigate()
  const profile = app.profile ?? normalizeProfile()
  const [flash, setFlash] = useState(null)
  const [resume, setResume] = useState(null)
  const profileRef = useRef(profile)
  useEffect(() => {
    profileRef.current = profile
  })

  useEffect(() => {
    app.refreshProfile().catch(() => {})
    resumeApi
      .load()
      .then(setResume)
      .catch(() => {})
    // once when the tab opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const edit = useCallback(
    (change) => {
      const result = applyEdit(profileRef.current, change)
      if (!result) return
      const [next, patch] = result
      app.setProfile(next)
      profileApi.patch(patch).then(
        (saved) => {
          if (saved) app.setProfile(normalizeProfile(saved))
          setFlash({ message: 'Saved', tone: 'positive' })
        },
        (e) => {
          setFlash({ message: `Couldn't save. ${e.message}`, tone: 'negative' })
          app.refreshProfile().catch(() => {})
        },
      )
    },
    [app],
  )

  const loading = !app.profile
  return (
    <Page className="profile">
      <PageHeader title="Profile" large actions={<BarButton icon={Settings} label="Settings" onClick={() => navigate('/settings')} />} />
      <div className="stack profile__stack">
        <ProfileHeader profile={profile} onHeadline={(text) => edit({ type: 'headline', text })} />

        <Group>
          <GroupRow to="/profile/resume" className="resume-row">
            <span className="row resume-row__inner">
              <PageThumbnail />
              <span className="stack">
                <span className="t-headline">Resume</span>
                <span className="t-subhead c-2">
                  {resume?.saved && resume.resume?.updatedAt ? `Updated ${relative(resume.resume.updatedAt)}` : 'Built from your profile'}
                </span>
              </span>
            </span>
          </GroupRow>
          <GroupRow onClick={() => navigate('/profile/pdf')} chevron={false}>
            <span className="row c-action profile__pdf">
              <FileText size={18} strokeWidth={2.2} aria-hidden /> View PDF
            </span>
          </GroupRow>
        </Group>

        {loading ? (
          <>
            <Group header="Target roles">
              <GroupRow>
                <SkeletonLines widths={[0.6, 0.8, 0.4]} highlighted={1} />
              </GroupRow>
            </Group>
            <Group header="Experience">
              <GroupRow>
                <SkeletonLines widths={[0.6, 0.8, 0.4]} highlighted={1} />
              </GroupRow>
            </Group>
          </>
        ) : (
          <>
            <Group header="Target roles">
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
            </Group>

            <Group header="Experience">
              {profile.experience.map((e, i) => (
                <GroupRow key={`${e.role}-${e.org}-${i}`} to={`/profile/experience/${i}`}>
                  <span className="t-headline">{e.role}</span>
                  <span className="t-subhead c-2">{e.org}</span>
                  {(e.start || e.end) && <span className="t-caption c-2">{[e.start, e.end || 'Present'].filter(Boolean).join(' – ')}</span>}
                </GroupRow>
              ))}
              <GroupRow to="/profile/experience/new" chevron={false}>
                <span className="row t-subhead semibold c-action profile__add">
                  <Plus size={17} strokeWidth={2.6} aria-hidden /> Add experience
                </span>
              </GroupRow>
            </Group>

            <Group header="Education">
              {profile.education.map((e, i) => (
                <GroupRow key={`${e.school}-${i}`} to={`/profile/education/${i}`}>
                  <span className="t-headline">{e.school}</span>
                  {(e.program || e.year || e.expectedGraduation) && (
                    <span className="t-subhead c-2">
                      {[e.program, e.year, e.expectedGraduation && `Graduating ${e.expectedGraduation}`].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </GroupRow>
              ))}
              <GroupRow to="/profile/education/new" chevron={false}>
                <span className="row t-subhead semibold c-action profile__add">
                  <Plus size={17} strokeWidth={2.6} aria-hidden /> Add education
                </span>
              </GroupRow>
            </Group>
          </>
        )}
      </div>
      <Flash message={flash?.message} tone={flash?.tone} icon={flash?.tone === 'positive' ? CircleCheck : undefined} duration={flash?.tone === 'negative' ? 3000 : 1400} onDone={() => setFlash(null)} />
      <Outlet context={{ profile, edit }} />
    </Page>
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
      <h2 className="profile-header__role rounded-num">{role ?? 'Pick a target role below'}</h2>
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

/** A white page with a sage title bar and a few grey lines, like ResumeCard's thumbnail. */
function PageThumbnail() {
  return (
    <span className="page-thumb" aria-hidden>
      <span className="page-thumb__title" />
      {[0.6, 0.45, 0.55, 0.35].map((w, i) => (
        <span key={i} style={{ width: `${w * 100}%` }} />
      ))}
    </span>
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
  if (!skills.length) return <p className="t-subhead c-2">Skillit picks these up from your resume and practice.</p>
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
