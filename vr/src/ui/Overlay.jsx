// 2D chrome around the canvas. Invisible once the headset takes over, so this is
// for the desktop preview, the judges watching the cast, and screen readers.
export function Overlay({ interview, headset, onEnterVR, vrSupported }) {
  const { phase, caption, question, sttSupported, transcript } = interview
  const signedIn = headset?.phase === 'signedIn'

  return (
    <div className="overlay">
      {/* Almost no app chrome over the room: the way into the headset, where
          there is one, and a way to sign this device out. Signing in happens on
          the keypad in the room. M still mutes; sample scores are labelled on the
          score panel itself. */}
      {(vrSupported || signedIn) && (
        <header className="bar">
          <div className="bar-actions">
            {signedIn && (
              <>
                <span className="chip">Signed in{headset.session?.deviceName ? ` · ${headset.session.deviceName}` : ''}</span>
                <button type="button" className="ghost" onClick={headset.signOut}>
                  Sign out
                </button>
              </>
            )}
            {vrSupported && (
              <button type="button" className="primary" onClick={onEnterVR}>
                Enter VR
              </button>
            )}
          </div>
        </header>
      )}

      <div className="bottom">
        <div className="hints">
        <kbd>Enter</kbd> begin · <kbd>Q</kbd> quick 1-min interview · then just talk · <kbd>Space</kbd> finish early · <kbd>M</kbd> mute
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
