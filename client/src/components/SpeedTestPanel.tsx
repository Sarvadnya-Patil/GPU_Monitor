import { useSpeedtests } from '../hooks/useSpeedtests'
import type { SpeedtestStatus } from '../types'
import { Card } from './Card'

const STATUS_COLOR: Record<SpeedtestStatus, string> = {
  pending: 'var(--warn)',
  running: 'var(--warn)',
  done: 'var(--good)',
  failed: 'var(--bad)',
}

export function SpeedTestPanel() {
  const { speedtests, requesting, requestSpeedtest } = useSpeedtests()
  const hasActive = speedtests.some((s) => s.status === 'pending' || s.status === 'running')

  return (
    <Card title="Network speed">
      <button
        onClick={() => requestSpeedtest()}
        disabled={requesting || hasActive}
        style={{
          border: '1px solid var(--border)',
          background: hasActive ? 'var(--bg-subtle)' : 'var(--text)',
          color: hasActive ? 'var(--text-muted)' : '#fff',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 13,
          cursor: hasActive ? 'default' : 'pointer',
        }}
      >
        {hasActive ? 'Running…' : 'Run speed test'}
      </button>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
        Runs on the workstation against speedtest.net, on demand only — it uses real
        bandwidth, so it never runs automatically.
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        {speedtests.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No speed tests yet</div>
        )}
        {speedtests.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              borderTop: '1px solid var(--border)',
              paddingTop: 8,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: STATUS_COLOR[s.status],
                  display: 'inline-block',
                }}
              />
              <span>{new Date(s.requested_at * 1000).toLocaleString()}</span>
              {s.server_name && (
                <span style={{ color: 'var(--text-muted)' }}>{s.server_name}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {s.status === 'done' ? (
                <>
                  <span>↓ {s.download_mbps?.toFixed(1)} Mbps</span>
                  <span>↑ {s.upload_mbps?.toFixed(1)} Mbps</span>
                  <span style={{ color: 'var(--text-muted)' }}>{s.ping_ms?.toFixed(0)} ms</span>
                </>
              ) : s.status === 'failed' && s.error ? (
                <span style={{ color: 'var(--bad)' }} title={s.error}>
                  error
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>{s.status}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
