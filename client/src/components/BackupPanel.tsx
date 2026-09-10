import { useState } from 'react'
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

function parsePaths(input: string): string[] {
  return input
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
}

export function BackupPanel() {
  const { backups, requesting, requestBackup } = useBackups()
  const hasActive = backups.some((b) => b.status === 'pending' || b.status === 'running')
  const [extraPathsInput, setExtraPathsInput] = useState('')

  const onBackupNow = () => {
    requestBackup(parsePaths(extraPathsInput))
    setExtraPathsInput('')
  }

  return (
    <Card title="Environment backup — pip cache, git install, pip freeze">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={extraPathsInput}
          onChange={(e) => setExtraPathsInput(e.target.value)}
          placeholder="Extra folders on the workstation, comma-separated (optional)"
          disabled={hasActive}
          style={{
            flex: '1 1 320px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            color: 'var(--text)',
            background: hasActive ? 'var(--bg-subtle)' : 'var(--bg)',
          }}
        />
        <button
          onClick={onBackupNow}
          disabled={requesting || hasActive}
          style={{
            border: '1px solid var(--border)',
            background: hasActive ? 'var(--bg-subtle)' : 'var(--text)',
            color: hasActive ? 'var(--text-muted)' : '#fff',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            cursor: hasActive ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {hasActive ? 'Backup in progress…' : 'Backup now'}
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
        e.g. ~/datasets/configs, ~/notes — paths are resolved on the workstation, not here.
      </div>

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
              {b.extra_paths.length > 0 && (
                <span style={{ color: 'var(--text-muted)' }} title={b.extra_paths.join(', ')}>
                  +{b.extra_paths.length} extra
                </span>
              )}
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
