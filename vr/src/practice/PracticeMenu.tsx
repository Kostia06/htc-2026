import "./practice.css";

export function PracticeMenu({ onSignOut }: { onSignOut: () => void }) {
  return (
    <main className="screen practice">
      <header className="practice-header">
        <p className="wordmark">Raven</p>
        <button className="button quiet" onClick={onSignOut}>
          Sign out
        </button>
      </header>
      <h1>Choose practice</h1>
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
