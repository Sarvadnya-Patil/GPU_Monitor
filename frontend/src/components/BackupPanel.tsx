import { api } from '../api'
import { useBackups } from '../hooks/useBackups'
import type { BackupStatus } from '../types'
import { Card } from './Card'

const STATUS_COLOR: Record<BackupStatus, string> = {
  pending: 'var(--warn)',
  running: 'var(--warn)',
  done: 'var(--good)',
  failed: 'var(--bad)',
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return mb > 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`
}

export function BackupPanel() {
  const { backups, requesting, requestBackup } = useBackups()
  const hasActive = backups.some((b) => b.status === 'pending' || b.status === 'running')

  return (
    <Card title="Environment backup — pip cache, git install, pip freeze">
      <button
        onClick={requestBackup}
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
        {hasActive ? 'Backup in progress…' : 'Backup now'}
      </button>

      <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        {backups.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No backups yet</div>
        )}
        {backups.map((b) => (
          <div
            key={b.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              borderTop: '1px solid var(--border)',
              paddingTop: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: STATUS_COLOR[b.status],
                  display: 'inline-block',
                }}
              />
              <span>{new Date(b.requested_at * 1000).toLocaleString()}</span>
              <span style={{ color: 'var(--text-muted)' }}>{b.status}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>{formatSize(b.size_bytes)}</span>
              {b.status === 'done' && (
                <a href={api.downloadBackupUrl(b.id)} style={{ color: 'var(--text)' }}>
                  Download
                </a>
              )}
              {b.status === 'failed' && b.error && (
                <span style={{ color: 'var(--bad)' }} title={b.error}>
                  error
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
