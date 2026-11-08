// GotTheJobSheet.swift: "I got the job", the end of a road. Sharing is on by default but explained, because it is
// what makes the road better for the next person, and only step kinds and skills ever leave the account.
import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import { companiesApi, outcomeApi } from '../../lib/client'
import { RaisedButton } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'

export default function GotTheJobSheet({ initialRole, onClose }) {
  const [role, setRole] = useState(initialRole ?? '')
  const [company, setCompany] = useState('')
  const [companies, setCompanies] = useState([])
  const [share, setShare] = useState(true)
  const [phase, setPhase] = useState({ name: 'editing' })

  useEffect(() => {
    companiesApi.list().then(
      (list) => setCompanies(list ?? []),
      () => setCompanies([]),
    )
  }, [])

  const save = async () => {
    if (!role.trim() || phase.name === 'saving') return
    setPhase({ name: 'saving' })
    try {
      const result = await outcomeApi.record({ role: role.trim(), company: company || undefined, share })
      setPhase({ name: 'done', shared: result.shared })
    } catch (e) {
      setPhase({ name: 'failed', message: e.message })
    }
  }

  return (
    <Sheet onClose={onClose} header={{ title: 'I got the job' }} label="I got the job">
      {phase.name === 'done' ? (
        <div className="stack got-job__done">
          <Flag size={48} strokeWidth={2} className="c-positive" aria-hidden />
          <h2 className="t-title">Congratulations</h2>
          <p className="t-body c-2">
            {phase.shared
              ? `Your road is now part of the map. The next person aiming for ${role.trim()} gets a clearer path.`
              : 'Saved to your own notes. You can always share your road later.'}
          </p>
        </div>
      ) : (
        <form
          className="stack form-sheet"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <label className="stack got-job__field">
            <span className="t-footnote c-2">What role?</span>
            <input className="form-sheet__field t-body" value={role} placeholder="Junior data analyst" autoFocus onChange={(e) => setRole(e.target.value)} />
          </label>
          {companies.length > 0 && (
            <label className="stack got-job__field">
              <span className="t-footnote c-2">Where?</span>
              <select className="form-sheet__field t-body" value={company} onChange={(e) => setCompany(e.target.value)}>
                <option value="">Somewhere else</option>
                {companies.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="row got-job__share t-body">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
            Help the next person
          </label>
          <p className="t-footnote c-2">
            Shares the kinds of steps you took and your skills, never your words, names or dates. It only shows once three people share a similar road.
          </p>
          {phase.name === 'failed' && <p className="t-footnote c-negative">{phase.message}</p>}
          <RaisedButton type="submit" busy={phase.name === 'saving'} disabled={!role.trim()}>
            Save
          </RaisedButton>
        </form>
      )}
    </Sheet>
  )
}
