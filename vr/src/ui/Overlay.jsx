// 2D chrome around the canvas. Invisible once the headset takes over, so this is
// for the desktop preview, the judges watching the cast, and screen readers.
export function Overlay({ interview, headset, onEnterVR, vrSupported }) {
  const { phase, caption, question, isStub, sttSupported, muted, transcript, actions } = interview
  const signedIn = headset?.phase === 'signedIn'

  return (
    <div className="overlay">
      <header className="bar">
        <div className="brand">
          <span className="dot" aria-hidden="true" />
          AI Mentor — Interview Room
        </div>
        <div className="bar-actions">
          {isStub && <span className="chip chip-warn">Example data</span>}
          {signedIn ? (
            <>
              <span className="chip">Signed in{headset.session?.deviceName ? ` · ${headset.session.deviceName}` : ''}</span>
              <button type="button" className="ghost" onClick={headset.signOut}>
                Sign out
              </button>
            </>
          ) : (
            headset && <span className="chip">Type the 4-digit code from your phone</span>
          )}
          <button type="button" className="ghost" onClick={actions.toggleMute} aria-pressed={muted}>
            {muted ? 'Voice off' : 'Voice on'}
          </button>
          <button
            type="button"
            className="primary"
            onClick={onEnterVR}
            disabled={!vrSupported}
            title={vrSupported ? 'Open in the headset' : 'No WebXR device detected'}
          >
            {vrSupported ? 'Enter VR' : 'VR unavailable'}
          </button>
        </div>
      </header>

      <div className="bottom">
        <div className="hints">
        <kbd>Enter</kbd> begin / next · <kbd>Space</kbd> hold to answer · <kbd>M</kbd> mute
          {!sttSupported && <span className="chip"> speech-to-text unavailable in this browser</span>}
        </div>

        {/* Captions are part of done — see CONTRIBUTING.md. aria-live so a screen
            reader announces each question as the interviewer asks it. */}
        <div className="captions" role="status" aria-live="polite">
          {caption && (
            <p className="caption-line">
              <strong>Interviewer:</strong> {caption}
            </p>
          )}
          {phase === 'listening' && (
            <p className="caption-line you">
              <strong>You:</strong> {transcript || <em>listening…</em>}
            </p>
          )}
        </div>
      </div>

      <noscript>This experience requires JavaScript.</noscript>
      <p className="sr-only">
        {question ? `Current question: ${question.text}` : 'Interview not started.'}
      </p>
    </div>
  )
}
