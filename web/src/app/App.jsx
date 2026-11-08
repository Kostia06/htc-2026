// Every screen has its own URL under /app. Sheets are child routes drawn over their screen, so a link opens them
// directly and the back button closes them. RootView.swift's phases decide which part of the tree is reachable.
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router'
import { WifiOff } from 'lucide-react'
import Recap from '../features/chat/Recap'
import { CompaniesList, CompanyView } from '../features/companies/Companies'
import FeedDetailSheet from '../features/foryou/FeedDetailSheet'
import ForYou from '../features/foryou/ForYou'
import Onboarding from '../features/onboarding/Onboarding'
import { History, SessionDetail } from '../features/practice/History'
import PairHeadset from '../features/practice/PairHeadset'
import PracticeHome from '../features/practice/PracticeHome'
import VoiceSession from '../features/practice/VoiceSession'
import Profile from '../features/profile/Profile'
import { EducationForm, ExperienceForm } from '../features/profile/ProfileForms'
import Resume from '../features/resume/Resume'
import { PdfSheet, SectionEditor } from '../features/resume/ResumeSheets'
import Roadmap from '../features/roadmap/Roadmap'
import { MarkDoneSheet, StepSheet, UpdateSheet } from '../features/roadmap/RoadmapSheets'
import { Memory, ShareMemory } from '../features/settings/Memory'
import { Privacy, Settings } from '../features/settings/Settings'
import SignIn from '../features/signin/SignIn'
import { Spinner } from '../ui/Button'
import { ContentUnavailable } from '../ui/Feedback'
import { useApp } from './context'
import { Ambient, Shell } from './Shell'

const HOME = '/roadmap'

/** Shows `children` only in the phase it belongs to; anything else is sent where the app currently is. */
function Gate({ need, children }) {
  const app = useApp()
  const location = useLocation()
  if (app.phase === 'starting')
    return (
      <div className="splash">
        <Ambient />
        <Spinner />
      </div>
    )
  if (app.phase === 'failed')
    return (
      <div className="splash">
        <Ambient />
        <ContentUnavailable icon={WifiOff} title="Can't reach Raven" description={app.message}>
          <button type="button" className="glass-prominent" style={{ width: '100%' }} onClick={app.retry}>
            Try again
          </button>
        </ContentUnavailable>
      </div>
    )
  if (app.phase === need) return children
  if (app.phase === 'signedOut') {
    // remember where they were going, and keep the landing page's ?mode=
    const from = location.pathname === '/' ? null : location.pathname + location.search
    return <Navigate to={{ pathname: '/signin', search: location.pathname === '/' ? location.search : '' }} state={from ? { from } : undefined} replace />
  }
  if (app.phase === 'onboarding') return <Navigate to="/onboarding" replace />
  return <Navigate to={location.state?.from ?? HOME} replace />
}

function PracticeRecap() {
  const navigate = useNavigate()
  return <Recap onClose={() => navigate('/practice')} />
}

function CompanyRecap() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const slug = pathname.split('/')[2]
  return <Recap companySlug={slug} onClose={() => navigate(`/companies/${slug}`)} />
}

export default function App() {
  return (
    <Routes>
      <Route
        path="signin"
        element={
          <Gate need="signedOut">
            <SignIn />
          </Gate>
        }
      />
      <Route
        path="onboarding"
        element={
          <Gate need="onboarding">
            <Onboarding />
          </Gate>
        }
      />
      <Route
        element={
          <Gate need="ready">
            <Outlet />
          </Gate>
        }
      >
        <Route path="practice/session" element={<VoiceSession />} />
        <Route element={<Shell />}>
          <Route index element={<Navigate to={HOME} replace />} />

          <Route path="roadmap" element={<Roadmap />}>
            <Route path="update" element={<UpdateSheet />} />
            <Route path="step/:id" element={<StepSheet />} />
            <Route path="step/:id/done" element={<MarkDoneSheet />} />
          </Route>

          <Route path="for-you" element={<ForYou />}>
            <Route path=":cardId" element={<FeedDetailSheet />} />
          </Route>

          <Route path="practice" element={<PracticeHome />}>
            <Route path="recap" element={<PracticeRecap />} />
          </Route>
          <Route path="practice/history" element={<History />} />
          <Route path="practice/history/:id" element={<SessionDetail />} />
          <Route path="practice/vr" element={<PairHeadset />} />

          <Route path="companies" element={<CompaniesList />} />
          <Route path="companies/:slug" element={<CompanyView />}>
            <Route path="recap" element={<CompanyRecap />} />
          </Route>

          <Route path="profile" element={<Profile />}>
            <Route path="experience/:index" element={<ExperienceForm />} />
            <Route path="education/:index" element={<EducationForm />} />
            <Route path="pdf" element={<PdfSheet back="/profile" />} />
          </Route>
          <Route path="profile/resume" element={<Resume />}>
            <Route path="edit/:section" element={<SectionEditor />} />
            <Route path="pdf" element={<PdfSheet back="/profile/resume" />} />
          </Route>

          <Route path="settings" element={<Settings />} />
          <Route path="settings/headset" element={<PairHeadset back={{ to: '/settings', label: 'Settings' }} />} />
          <Route path="settings/privacy" element={<Privacy />} />
          <Route path="settings/memory" element={<Memory />}>
            <Route path=":id/share" element={<ShareMemory />} />
          </Route>

          <Route path="*" element={<Navigate to={HOME} replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
