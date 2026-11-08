// ExperienceForm.swift and EducationForm.swift as sheets at /profile/experience/:index and /profile/education/:index
// ("new" adds one). Cancel and Save in the bar; an existing entry can also be deleted here.
import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router'
import { Sheet } from '../../ui/Sheet'

const BACK = '/profile'

function FormSheet({ title, canSave, onSave, onDelete, children }) {
  const navigate = useNavigate()
  const close = () => navigate(BACK)
  return (
    <Sheet
      onClose={close}
      size="detail"
      header={{
        title,
        leading: (done) => (
          <button type="button" className="t-body c-action sheet-text-btn" onClick={done}>
            Cancel
          </button>
        ),
        trailing: (done) => (
          <button
            type="button"
            className="t-body semibold c-action sheet-text-btn"
            disabled={!canSave}
            onClick={() => {
              onSave()
              done()
            }}
          >
            Save
          </button>
        ),
      }}
    >
      {(done) => (
        <form
          className="stack form-sheet"
          onSubmit={(e) => {
            e.preventDefault()
            if (!canSave) return
            onSave()
            done()
          }}
        >
          {children}
          <button type="submit" hidden />
          {onDelete && (
            <button
              type="button"
              className="form-sheet__delete t-body"
              onClick={() => {
                onDelete()
                done()
              }}
            >
              Delete
            </button>
          )}
        </form>
      )}
    </Sheet>
  )
}

function Field({ label, value, onChange, required, autoFocus }) {
  return (
    <input className="form-sheet__field t-body" value={value ?? ''} placeholder={label} aria-label={label} required={required} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
  )
}

function useEntry(key) {
  const { index } = useParams()
  const navigate = useNavigate()
  const { profile, edit } = useOutletContext()
  const isNew = index === 'new'
  const old = isNew ? null : profile[key][Number(index)]
  useEffect(() => {
    if (!isNew && !old) navigate(BACK, { replace: true })
  }, [isNew, old, navigate])
  return { old, edit }
}

export function ExperienceForm() {
  const { old, edit } = useEntry('experience')
  const [row, setRow] = useState(() => ({ role: '', org: '', start: '', end: '', ...old }))
  const set = (k) => (v) => setRow((r) => ({ ...r, [k]: v }))
  const valid = row.role.trim() && row.org.trim()
  return (
    <FormSheet
      title={old ? 'Edit experience' : 'Add experience'}
      canSave={Boolean(valid)}
      onSave={() => edit({ type: 'saveExperience', row, old })}
      onDelete={old ? () => edit({ type: 'removeExperience', row: old }) : null}
    >
      <div className="form-sheet__group">
        <Field label="Role" value={row.role} onChange={set('role')} required autoFocus />
        <Field label="Company or team" value={row.org} onChange={set('org')} required />
      </div>
      <p className="form-sheet__header t-footnote">When</p>
      <div className="form-sheet__group">
        <Field label="Started, like May 2026" value={row.start} onChange={set('start')} />
        <Field label="Ended, or leave blank" value={row.end} onChange={set('end')} />
      </div>
    </FormSheet>
  )
}

export function EducationForm() {
  const { old, edit } = useEntry('education')
  const [row, setRow] = useState(() => ({ school: '', program: '', year: '', expectedGraduation: '', ...old }))
  const set = (k) => (v) => setRow((r) => ({ ...r, [k]: v }))
  return (
    <FormSheet
      title={old ? 'Edit education' : 'Add education'}
      canSave={Boolean(row.school.trim())}
      onSave={() => edit({ type: 'saveEducation', row, old })}
      onDelete={old ? () => edit({ type: 'removeEducation', row: old }) : null}
    >
      <div className="form-sheet__group">
        <Field label="School" value={row.school} onChange={set('school')} required autoFocus />
        <Field label="Program, like BSc Computer Science" value={row.program} onChange={set('program')} />
      </div>
      <p className="form-sheet__header t-footnote">Where you&rsquo;re at</p>
      <div className="form-sheet__group">
        <Field label="Year, like Third-year" value={row.year} onChange={set('year')} />
        <Field label="Expected graduation, like April 2028" value={row.expectedGraduation} onChange={set('expectedGraduation')} />
      </div>
    </FormSheet>
  )
}
