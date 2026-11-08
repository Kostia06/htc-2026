// SkillsEditor.swift as a sheet at /profile/skills: add (with suggestions), rename in place, remove.
// Nothing is saved until Done, and then it's one patch through the page's `edit`.
import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router'
import { CircleMinus, CirclePlus, Plus } from 'lucide-react'
import { Sheet } from '../../ui/Sheet'
import { QUESTIONS } from '../onboarding/questions'
import { addSkill, canAdd, contains, draftFrom, removeSkill, renameSkill, sourceOf, suggestions } from './skillsDraft'

const COMMON_SKILLS = QUESTIONS.find((q) => q.id === 'skills')?.options ?? []
const SOURCE_LABELS = { resume: 'From your resume', interview: 'From practice', 'self-reported': 'Added by you' }

export function SkillsEditor() {
  const navigate = useNavigate()
  const { profile, edit } = useOutletContext()
  const [draft, setDraft] = useState(() => draftFrom(profile.skills))
  const [text, setText] = useState('')
  const [problem, setProblem] = useState(null)

  const add = (name) => {
    const next = addSkill(draft, name)
    if (next) {
      setDraft(next)
      setText('')
      setProblem(null)
    } else if (contains(draft, name.trim())) {
      setProblem(`${name.trim()} is already on your list.`)
    }
  }
  const rename = (id, name) => {
    const next = renameSkill(draft, id, name)
    if (next) {
      setDraft(next)
      setProblem(null)
    } else if (name.trim() && contains(draft, name.trim(), id)) {
      setProblem(`${name.trim()} is already on your list.`)
    }
  }
  const offered = canAdd(draft) ? suggestions(draft, text, COMMON_SKILLS) : []

  return (
    <Sheet
      onClose={() => navigate('/profile')}
      size="detail"
      header={{
        title: 'Edit skills',
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
              edit({ type: 'saveSkills', draft })
              done()
            }}
          >
            Done
          </button>
        ),
      }}
    >
      {() => (
        <div className="stack form-sheet">
          <div className="form-sheet__group skills-editor__add">
            <form
              className="row chips-editor__add"
              onSubmit={(e) => {
                e.preventDefault()
                add(text)
              }}
            >
              <CirclePlus size={20} strokeWidth={2.2} className="c-2" aria-hidden />
              <input
                className="grow chips-editor__input t-body"
                value={text}
                placeholder="Add a skill"
                aria-label="Add a skill"
                disabled={!canAdd(draft)}
                onChange={(e) => setText(e.target.value)}
              />
              {text.trim() && (
                <button type="submit" className="t-headline c-action">
                  Add
                </button>
              )}
            </form>
            {offered.length > 0 && (
              <div className="chips-editor__chips skills-editor__suggestions">
                {offered.map((name) => (
                  <button key={name} type="button" className="edit-chip skills-editor__suggestion t-subhead" onClick={() => add(name)} aria-label={`Add ${name}`}>
                    <Plus size={13} strokeWidth={2.6} aria-hidden /> {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {problem && (
            <p className="form-sheet__footer skills-editor__problem t-footnote" role="alert">
              {problem}
            </p>
          )}
          {!problem && !canAdd(draft) && <p className="form-sheet__footer t-footnote">That&rsquo;s the most Skillit keeps. Remove one to add another.</p>}

          <p className="form-sheet__header t-footnote">Your skills ({draft.rows.length})</p>
          <div className="form-sheet__group">
            {draft.rows.length === 0 && <p className="skills-editor__row t-body c-2">No skills yet.</p>}
            {draft.rows.map((r) => (
              // keyed by name too, so a landed rename remounts the field with the new name
              <SkillRow key={`${r.id}-${r.name}`} row={r} onRename={(name) => rename(r.id, name)} onRemove={() => setDraft(removeSkill(draft, r.id))} />
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}

/** One skill: a visible remove button, the name as a field (rename by editing it) and where it came from. */
function SkillRow({ row, onRename, onRemove }) {
  const [name, setName] = useState(row.name)
  const commit = () => {
    onRename(name)
    // a refused rename snaps back to the current name
    setName(row.name)
  }
  return (
    <div className="row skills-editor__row">
      <button type="button" className="skills-editor__remove" onClick={onRemove} aria-label={`Remove ${row.name}`}>
        <CircleMinus size={22} strokeWidth={2.2} aria-hidden />
      </button>
      <span className="stack grow">
        <input
          className="chips-editor__input t-body skills-editor__name"
          value={name}
          aria-label={`Rename ${row.name}`}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              // undo the typing, not the whole sheet
              e.stopPropagation()
              setName(row.name)
            }
          }}
        />
        <span className="t-caption c-2">{SOURCE_LABELS[sourceOf(row)]}</span>
      </span>
    </div>
  )
}
