// ConnectedAppsView.swift at /profile/connections: the "Bring your work" list on its own page, behind a Profile door and
// the plus menu's Connect. An import or a disconnect changes the profile on the server, so the profile is reloaded and
// every screen that listens for updates (Road, Resume, Profile) refreshes.
import { useCallback } from 'react'
import { useApp } from '../../app/context'
import { announceUpdatesApplied } from '../../lib/hooks'
import { Group, GroupRow, Page, PageHeader } from '../../ui/Layout'
import BringYourWork from './BringYourWork'
import OtherApps from './OtherApps'

export default function ConnectedApps() {
  const app = useApp()
  const changed = useCallback(() => {
    app.refreshProfile().catch(() => {})
    announceUpdatesApplied([])
  }, [app])

  return (
    <Page className="profile">
      <PageHeader title="Connected apps" back={{ to: '/profile', label: 'Profile' }} />
      <div className="stack profile__stack">
        <Group footer="Each one is optional. Skillit adds your projects and their main languages; disconnecting removes only what that service added.">
          <GroupRow>
            <BringYourWork onChange={changed} />
          </GroupRow>
        </Group>
        <Group header="More apps" footer="Connected through Composio. Nothing is imported; Skillit's assistant can only look things up in them when you ask, and never posts or changes anything. Disconnecting revokes access.">
          <GroupRow>
            <OtherApps />
          </GroupRow>
        </Group>
      </div>
    </Page>
  )
}
