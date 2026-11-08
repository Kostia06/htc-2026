// AccountsStep.swift: the optional step after the resume. Bring work from any service, review a LinkedIn PDF, or skip it all.
import { useState } from 'react'
import { Briefcase } from 'lucide-react'
import { RaisedButton } from '../../ui/Button'
import { OptionTile } from '../../ui/Controls'
import BringYourWork from '../connections/BringYourWork'
import LinkedinReview from '../connections/LinkedinReview'

export default function AccountsStep({ onNext }) {
  const [linkedin, setLinkedin] = useState(false)
  const [anyConnected, setAnyConnected] = useState(false)
  return (
    <div className="stack ob__options">
      <div className="ob__panel">
        <BringYourWork onAnyConnected={setAnyConnected} />
      </div>
      {linkedin ? (
        <div className="ob__panel">
          <LinkedinReview />
        </div>
      ) : (
        <OptionTile onClick={() => setLinkedin(true)}>
          <Briefcase size={22} strokeWidth={2.2} className="c-action" aria-hidden />
          <span className="stack">
            <span>Review my LinkedIn</span>
            <span className="t-footnote c-2 ob__sub">From LinkedIn&rsquo;s Save to PDF</span>
          </span>
        </OptionTile>
      )}
      {/* every row is optional and so is the whole step */}
      <RaisedButton onClick={onNext}>{anyConnected ? 'Continue' : 'Skip for now'}</RaisedButton>
    </div>
  )
}
