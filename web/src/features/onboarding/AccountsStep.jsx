// AccountsStep.swift: the optional step after the resume. Connect GitHub, review a LinkedIn PDF, or move on.
import { useState } from 'react'
import { Briefcase } from 'lucide-react'
import { RaisedButton } from '../../ui/Button'
import { OptionTile } from '../../ui/Controls'
import GithubConnect from '../connections/GithubConnect'
import LinkedinReview from '../connections/LinkedinReview'

export default function AccountsStep({ onNext }) {
  const [linkedin, setLinkedin] = useState(false)
  return (
    <div className="stack ob__options">
      <div className="ob__panel">
        <GithubConnect />
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
      <RaisedButton onClick={onNext}>Continue</RaisedButton>
    </div>
  )
}
