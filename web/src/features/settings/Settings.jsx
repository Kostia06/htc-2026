// SettingsView.swift and PrivacyView.swift: account, headset, voice, privacy and about; and what Skillit keeps,
// with the one button that deletes all of it.
import { useState } from 'react'
import { Brain, FileLock, FileText, Glasses, Lock, Route, AudioWaveform } from 'lucide-react'
import { useApp } from '../../app/context'
import { profileApi } from '../../lib/client'
import { Spinner } from '../../ui/Button'
import { Flash } from '../../ui/Feedback'
import { Group, GroupRow, Page, PageHeader } from '../../ui/Layout'
import { Confirm } from '../../ui/Sheet'
import './settings.css'

const VERSION = import.meta.env.VITE_APP_VERSION ?? 'web'

export function Settings() {
  const app = useApp()
  const [confirming, setConfirming] = useState(false)
  const account = app.email ?? (app.provider === 'apple' ? 'Apple ID' : 'Signed in')
  return (
    <Page className="settings">
      <PageHeader title="Settings" back={{ to: '/profile', label: 'Profile' }} />
      <div className="stack settings__stack">
        <Group header="Account">
          <GroupRow>
            <span className="row settings__labeled">
              <span className="grow">Signed in as</span>
              <span className="c-2 settings__value">{account}</span>
            </span>
          </GroupRow>
          <GroupRow destructive onClick={() => setConfirming(true)}>
            Sign out
          </GroupRow>
        </Group>

        <Group header="Headset">
          <GroupRow to="/settings/headset">
            <IconLabel icon={Glasses}>Pair a headset</IconLabel>
          </GroupRow>
        </Group>

        <Group header="Practice voice" footer="The same voice in your browser and on your headset.">
          <GroupRow>
            <span className="row settings__labeled">
              <span className="grow">Interviewer</span>
              <span className="c-2">Eric</span>
            </span>
          </GroupRow>
        </Group>

        <Group header="Privacy">
          <GroupRow to="/settings/privacy">
            <IconLabel icon={Lock}>Your data</IconLabel>
          </GroupRow>
        </Group>

        <Group
          header="About"
          footer="Skillit uses AI to read your resume, build your roadmap and run practice conversations. It can get things wrong; check anything before you rely on it."
        >
          <GroupRow>
            <span className="row settings__labeled">
              <span className="grow">Version</span>
              <span className="c-2">{VERSION}</span>
            </span>
          </GroupRow>
        </Group>
      </div>
      {confirming && (
        <Confirm
          title="Sign out of Skillit?"
          message="Your profile stays saved, and paired headsets stay signed in."
          confirmLabel="Sign out"
          onConfirm={() => app.signOut()}
          onClose={() => setConfirming(false)}
        />
      )}
    </Page>
  )
}

function IconLabel({ icon: Icon, children }) {
  return (
    <span className="row settings__icon-label">
      <Icon size={19} strokeWidth={2} className="c-action" aria-hidden />
      {children}
    </span>
  )
}

const KEPT = [
  [FileLock, 'Profile', 'Encrypted with a key tied to your account; only you can read it.'],
  [FileText, 'Resume text', 'Deleted an hour after upload. Only what you confirm stays, in your profile.'],
  [AudioWaveform, 'Practice sessions', 'Transcripts and scores, encrypted the same way.'],
  [Route, 'Roadmap and feed', 'Built from your profile; rebuilt when it changes.'],
]

export function Privacy() {
  const app = useApp()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [failure, setFailure] = useState(null)

  const eraseAll = async () => {
    setDeleting(true)
    try {
      await profileApi.eraseAll()
      await app.signOut()
    } catch (e) {
      setFailure(`Couldn't delete your data. ${e.message}`)
      setDeleting(false)
    }
  }

  return (
    <Page className="settings">
      <PageHeader title="Your data" back={{ to: '/settings', label: 'Settings' }} />
      <div className="stack settings__stack">
        <Group header="What Skillit keeps">
          {KEPT.map(([Icon, title, detail]) => (
            <GroupRow key={title}>
              <span className="row settings__kept">
                <Icon size={20} strokeWidth={2} className="c-agent" aria-hidden />
                <span className="stack">
                  <span className="t-headline">{title}</span>
                  <span className="t-subhead c-2">{detail}</span>
                </span>
              </span>
            </GroupRow>
          ))}
        </Group>

        <Group footer="See, delete or anonymously share the notes Skillit keeps to personalise your practice.">
          <GroupRow to="/settings/memory">
            <span className="row settings__icon-label">
              <Brain size={19} strokeWidth={2} className="c-action" aria-hidden />
              What Skillit remembers about you
            </span>
          </GroupRow>
        </Group>

        <Group footer="Removes your profile, memories, roadmap, feed and practice sessions from Skillit's servers, then signs you out. This can't be undone.">
          <GroupRow destructive onClick={deleting ? undefined : () => setConfirming(true)}>
            <span className="row settings__icon-label">
              Delete my data
              {deleting && <Spinner size={15} />}
            </span>
          </GroupRow>
        </Group>
      </div>
      {confirming && (
        <Confirm
          title="Delete everything Skillit knows about you?"
          message="Your profile, memories, roadmap, feed and practice sessions are removed for good, and you're signed out."
          confirmLabel="Delete my data"
          onConfirm={eraseAll}
          onClose={() => setConfirming(false)}
        />
      )}
      <Flash message={failure} tone="negative" duration={4000} onDone={() => setFailure(null)} />
    </Page>
  )
}

