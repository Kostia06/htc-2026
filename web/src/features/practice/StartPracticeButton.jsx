// StartPracticeButton.swift: a compact "Start" capsule that opens into two raised choices, here in the browser or
// in VR. While open it watches for a paired headset; sending to one shows a short confirmation.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { CircleCheck, Glasses, Laptop } from 'lucide-react'
import { headsetApi } from '../../lib/client'
import { useInterval } from '../../lib/hooks'
import { RaisedButton } from '../../ui/Button'
import './practice.css'

export default function StartPracticeButton({ companySlug, role, stepId, onLive }) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('compact')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)

  const check = () =>
    headsetApi
      .status()
      .then(setStatus)
      .catch(() => {})
  useInterval(check, 2000, phase === 'expanded')

  useEffect(() => {
    if (phase !== 'sent') return undefined
    const t = setTimeout(() => setPhase('compact'), 3000)
    return () => clearTimeout(t)
  }, [phase])

  const open = () => {
    setPhase('expanded')
    setError(null)
    check()
  }

  const inVR = async () => {
    if (!status?.connected) {
      navigate('/practice/vr')
      return
    }
    setSending(true)
    setError(null)
    try {
      await headsetApi.launch({ companySlug, role, stepId })
      setPhase('sent')
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  if (phase === 'compact')
    return (
      <button type="button" className="start-pill" onClick={open}>
        Start
      </button>
    )

  if (phase === 'sent')
    return (
      <p className="start-sent t-subhead semibold" role="status">
        <CircleCheck size={17} strokeWidth={2.4} aria-hidden /> Sent to your headset
      </p>
    )

  const connected = status?.devices?.find((d) => d.connected)
  return (
    <div className="start-panel">
      <div className="row start-panel__head">
        <span className="t-subhead semibold grow">Start</span>
        <button type="button" className="t-subhead c-2 start-panel__dismiss" onClick={() => setPhase('compact')}>
          Not now
        </button>
      </div>
      <RaisedButton icon={Laptop} onClick={onLive}>
        Live in browser
      </RaisedButton>
      <RaisedButton variant="raised" onClick={inVR} busy={sending} className="start-panel__vr">
        {!sending && <Glasses size={19} strokeWidth={2.4} aria-hidden />}
        In VR
        <span className="start-panel__status t-footnote c-2">
          {connected ? (
            <>
              <span className="dot-connected" aria-hidden /> {connected.name} connected
            </>
          ) : status ? (
            'Pair a headset'
          ) : (
            ''
          )}
        </span>
      </RaisedButton>
      {error && <p className="t-footnote c-negative">{error}</p>}
    </div>
  )
}
