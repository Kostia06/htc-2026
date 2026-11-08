import "./practice.css";
import { type ProfileState, usePracticeProfile } from "./usePracticeProfile";

export function PracticeMenu({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const profile = usePracticeProfile(token, onSignOut);
  return (
    <main className="screen practice">
      <header className="practice-header">
        <p className="wordmark">Raven</p>
        <button className="button quiet" onClick={onSignOut}>
          Sign out of this headset
        </button>
      </header>
      <ProfileSummary state={profile} />
      <div className="practice-options">
        <button className="practice-option">
          <span className="practice-title">Interview</span>
          <span className="practice-hint">Answer questions from a hiring manager</span>
        </button>
        <button className="practice-option">
          <span className="practice-title">Networking</span>
          <span className="practice-hint">Introduce yourself at an industry event</span>
        </button>
      </div>
    </main>
  );
}

function ProfileSummary({ state }: { state: ProfileState }) {
  if (state.phase === "loading") {
    return (
      <section className="profile-summary" aria-busy="true" aria-label="Loading your profile">
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-line" />
      </section>
    );
  }
  const targetRole = state.phase === "ready" ? state.profile.targetRoles[0] : undefined;
  const headline = state.phase === "ready" ? state.profile.headline : undefined;
  return (
    <section className="profile-summary">
      <h1>{targetRole ? `Practice for ${targetRole}` : "Choose practice"}</h1>
      {headline && <p className="lead">{headline}</p>}
    </section>
  );
}
