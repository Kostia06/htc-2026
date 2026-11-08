// Every screen has its own URL under /app. Sheets are child routes drawn over their screen, so a link opens them
// directly and the back button closes them. RootView.swift's phases decide which part of the tree is reachable.
import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'
import { WifiOff } from 'lucide-react'
import { Spinner } from '../ui/Button'
import { ContentUnavailable } from '../ui/Feedback'
import { useApp } from './context'
import { Ambient, Shell } from './Shell'

// Each screen is its own chunk, fetched the first time its route is visited. Navigations run as transitions,
// so the current screen stays up while the next one loads.
const named = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })))

const SignIn = lazy(() => import('../features/signin/SignIn'))
const Onboarding = lazy(() => import('../features/onboarding/Onboarding'))
const Roadmap = lazy(() => import('../features/roadmap/Roadmap'))
const roadmapSheets = () => import('../features/roadmap/RoadmapSheets')
const UpdateSheet = named(roadmapSheets, 'UpdateSheet')
const StepSheet = named(roadmapSheets, 'StepSheet')
const MarkDoneSheet = named(roadmapSheets, 'MarkDoneSheet')
const ForYou = lazy(() => import('../features/foryou/ForYou'))
const FeedDetailSheet = lazy(() => import('../features/foryou/FeedDetailSheet'))
const PracticeHome = lazy(() => import('../features/practice/PracticeHome'))
const VoiceSession = lazy(() => import('../features/practice/VoiceSession'))
const PairHeadset = lazy(() => import('../features/practice/PairHeadset'))
const history = () => import('../features/practice/History')
const History = named(history, 'History')
const SessionDetail = named(history, 'SessionDetail')
const Recap = lazy(() => import('../features/chat/Recap'))
const companies = () => import('../features/companies/Companies')
const CompaniesList = named(companies, 'CompaniesList')
const CompanyView = named(companies, 'CompanyView')
const Profile = lazy(() => import('../features/profile/Profile'))
const profileForms = () => import('../features/profile/ProfileForms')
const ExperienceForm = named(profileForms, 'ExperienceForm')
const EducationForm = named(profileForms, 'EducationForm')
const Resume = lazy(() => import('../features/resume/Resume'))
const resumeSheets = () => import('../features/resume/ResumeSheets')
const SectionEditor = named(resumeSheets, 'SectionEditor')
const PdfSheet = named(resumeSheets, 'PdfSheet')
const TailorSheet = named(() => import('../features/resume/tailored/TailorSheet'), 'TailorSheet')
const TailoredSheet = named(() => import('../features/resume/tailored/TailoredSheet'), 'TailoredSheet')
const settings = () => import('../features/settings/Settings')
const Settings = named(settings, 'Settings')
const Privacy = named(settings, 'Privacy')
const memory = () => import('../features/settings/Memory')
const Memory = named(memory, 'Memory')
const ShareMemory = named(memory, 'ShareMemory')

const HOME = '/roadmap'

function Splash() {
  return (
    <div className="splash">
      <Ambient />
      <Spinner />
    </div>
  )
}

/** Shows `children` only in the phase it belongs to; anything else is sent where the app currently is. */
function Gate({ need, children }) {
  const app = useApp()
  const location = useLocation()
  if (app.phase === 'starting') return <Splash />
  if (app.phase === 'failed')
    return (
      <div className="splash">
        <Ambient />
        <ContentUnavailable icon={WifiOff} title="Can't reach Skillit" description={app.message}>
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

/** An old address: sends it on to `to`, keeping the rest of the path and the query. */
function Moved({ to }) {
  const { '*': rest } = useParams()
  const { search } = useLocation()
  return <Navigate to={`${to}${rest ? `/${rest}` : ''}${search}`} replace />
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
    <Suspense fallback={<Splash />}>
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
            <Route path="profile/resume/*" element={<Moved to="/resume" />} />

            <Route path="resume" element={<Resume />}>
              <Route path="edit/:section" element={<SectionEditor />} />
              <Route path="pdf" element={<PdfSheet back="/resume" />} />
              <Route path="tailor" element={<TailorSheet />} />
              <Route path="tailored/:id" element={<TailoredSheet />} />
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
    </Suspense>
  )
}
