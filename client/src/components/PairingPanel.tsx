import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { Card } from './Card'

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PairingPanel() {
  const [code, setCode] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [generating, setGenerating] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const generate = async () => {
    setGenerating(true)
    try {
      const r = await api.createPairingCode()
      setCode(r.code)
      const tick = () => {
        const left = Math.max(0, Math.round(r.expires_at - Date.now() / 1000))
        setRemaining(left)
        if (left <= 0) {
          setCode(null)
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      }
      tick()
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(tick, 1000)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Card title="Pair a new agent">
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Generates a one-time code, valid for 5 minutes, to run on the GPU workstation
        instead of copying the AGENT_TOKEN by hand:{' '}
        <code>python pair.py {'<server-url>'} {'<code>'}</code>
      </div>

      {code ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 22,
              letterSpacing: 3,
              fontWeight: 600,
            }}
          >
            {code}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            expires in {formatRemaining(remaining)}
          </span>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={generating}
          style={{
            border: '1px solid var(--border)',
            background: 'var(--text)',
            color: '#fff',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            cursor: generating ? 'default' : 'pointer',
          }}
        >
          Generate pairing code
        </button>
      )}
    </Card>
  )
}
