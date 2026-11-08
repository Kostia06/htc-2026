// PairHeadsetView.swift: a 4-digit code inside a ring that counts down its two minutes. The headset types it in;
// once claimed, it stays signed in until removed in the list below.
import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleCheck, Glasses, WifiOff } from 'lucide-react'
import { headsetApi, pairingApi } from '../../lib/client'
import { relative } from '../../lib/format'
import { useInterval } from '../../lib/hooks'
import { RaisedButton } from '../../ui/Button'
import { Page, PageHeader } from '../../ui/Layout'
import './practice.css'

const LIFETIME_S = 120
const HEADSET_SITE = 'raven-vr.ilnkostia-dev.workers.dev'

export default function PairHeadset({ back = { to: '/practice', label: 'Practice' } }) {
  const [phase, setPhase] = useState('loading') // loading | code | connected | failed
  const [code, setCode] = useState(null)
  const [message, setMessage] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [devices, setDevices] = useState([])
  const alive = useRef(true)

  const offer = useCallback(
    () =>
      pairingApi.offer().then(
        (next) => {
          if (!alive.current) return
          setCode(next)
          setPhase('code')
        },
        (e) => {
          if (!alive.current) return
          setMessage(e.message)
          setPhase('failed')
        },
      ),
    [],
  )

  useEffect(() => {
    alive.current = true
    offer()
    return () => {
      alive.current = false
    }
  }, [offer])

  // a failure tries again after a moment
  useEffect(() => {
    if (phase !== 'failed') return undefined
    const t = setTimeout(() => {
      setPhase('loading')
      offer()
    }, 3000)
    return () => clearTimeout(t)
  }, [phase, offer])

  useInterval(() => setNow(Date.now()), 1000, phase === 'code')

  useInterval(
    async () => {
      if (!code) return
      const expired = Date.now() >= new Date(code.expiresAt).getTime()
      const status = await pairingApi.status(code.code).catch(() => (expired ? 'expired' : 'waiting'))
      if (!alive.current) return
      if (status === 'claimed') setPhase('connected')
      else if (status === 'expired' || expired) offer()
    },
    1500,
    phase === 'code',
  )

  const checkDevices = () =>
    headsetApi
      .status()
      .then((s) => alive.current && setDevices(s.devices ?? []))
      .catch(() => {})
  useInterval(checkDevices, 2000, true, true)

  const remove = async (id) => {
    setDevices((d) => d.filter((x) => x.id !== id))
    await headsetApi.revoke(id).catch(checkDevices)
  }

  const remaining = code ? Math.max(0, Math.round((new Date(code.expiresAt).getTime() - now) / 1000)) : LIFETIME_S

  return (
    <Page className="pair">
      <PageHeader title="Practice in VR" back={back} />
      <div className="pair__stack">
        {phase === 'connected' ? (
          <div className="pair__connected">
            <CircleCheck size={88} strokeWidth={1.6} className="pair__check" aria-hidden />
            <h2 className="t-title">Headset connected</h2>
            <p className="t-body c-2">Put it on to start practicing. It stays signed in until you remove it here.</p>
            <RaisedButton
              onClick={() => {
                setPhase('loading')
                offer()
              }}
              className="pair__again"
            >
              Pair another headset
            </RaisedButton>
          </div>
        ) : phase === 'failed' ? (
          <div className="card stack pair__failed">
            <p className="t-body row" style={{ gap: 8, color: '#ff9f0a' }}>
              <WifiOff size={18} aria-hidden /> {message}
            </p>
            <p className="t-footnote c-2">Trying again in a moment.</p>
          </div>
        ) : (
          <>
            <CodeRing code={phase === 'code' ? code.code : null} remaining={remaining} />
            <p className="t-body c-2 pair__instructions">
              On your headset, open
              <br />
              <strong className="c-action">{HEADSET_SITE}</strong>
              <br />
              and enter this code
            </p>
            <p className="t-subhead c-2 row pair__waiting">
              <Glasses size={17} strokeWidth={2.2} aria-hidden /> Waiting for your headset
            </p>
          </>
        )}

        {devices.length > 0 && (
          <section className="pair__devices">
            <h2 className="t-headline">Your headsets</h2>
            {devices.map((d) => (
              <div key={d.id} className="card row device-row">
                <Glasses size={22} strokeWidth={2} className={d.connected ? 'c-action' : 'c-2'} aria-hidden />
                <div className="grow stack">
                  <span className="t-body medium">{d.name}</span>
                  <span className="t-footnote c-2 row device-row__seen">
                    {d.connected ? (
                      <>
                        <span className="dot-connected" aria-hidden /> Connected now
                      </>
                    ) : (
                      `Last seen ${relative(d.lastSeenAt)}`
                    )}
                  </span>
                </div>
                <button type="button" className="glass-button" onClick={() => remove(d.id)}>
                  Remove
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
    </Page>
  )
}

/** CodeCountdownRing.swift: 272px, 8px stroke, the digits spaced out in the middle and the time left below. */
function CodeRing({ code, remaining }) {
  const r = 132
  const circumference = 2 * Math.PI * r
  const fraction = remaining / LIFETIME_S
  const m = Math.floor(remaining / 60)
  const s = String(remaining % 60).padStart(2, '0')
  return (
    <div className={`code-ring${code ? '' : ' shimmering'}`} role="img" aria-label={code ? `Code ${code.split('').join(' ')}, ${m}:${s} left` : 'Getting a code'}>
      <svg viewBox="0 0 272 272" width="272" height="272" aria-hidden>
        <circle cx="136" cy="136" r={r} className="code-ring__track" />
        {code && <circle cx="136" cy="136" r={r} className="code-ring__progress" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)} />}
      </svg>
      {code && (
        <div className="code-ring__center">
          <span className="code-ring__digits rounded-num">
            {code.split('').map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </span>
          <span className="t-subhead mono c-2">
            {m}:{s}
          </span>
        </div>
      )}
    </div>
  )
}
