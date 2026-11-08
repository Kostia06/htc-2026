// ReviewInHeadsetButton.swift: sends this session's review to the paired headset, where it opens as moments to play from.
import { useState } from 'react'
import { Check, Glasses } from 'lucide-react'
import { headsetApi } from '../../lib/client'
import { RaisedButton } from '../../ui/Button'

const TITLES = { ready: 'Review in headset', sending: 'Sending…', sent: 'Sent to headset', failed: 'Try again' }

export default function ReviewInHeadsetButton({ sessionId }) {
  const [phase, setPhase] = useState('ready')
  const send = async () => {
    setPhase('sending')
    try {
      await headsetApi.launch({ reviewSessionId: sessionId })
      setPhase('sent')
    } catch {
      setPhase('failed')
    }
  }
  return (
    <RaisedButton variant="grey" icon={phase === 'sent' ? Check : Glasses} busy={phase === 'sending'} onClick={send} title="Opens this review in your headset">
      {TITLES[phase]}
    </RaisedButton>
  )
}
