interface Props {
  online: boolean
  lastSeenTs: number | null
}

function timeAgo(ts: number | null): string {
  if (!ts) return 'never'
  const seconds = Math.floor(Date.now() / 1000 - ts)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function StatusBar({ online, lastSeenTs }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: 'var(--text-muted)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: online ? 'var(--good)' : 'var(--bad)',
          display: 'inline-block',
        }}
      />
      <span style={{ color: online ? 'var(--good)' : 'var(--bad)', fontWeight: 500 }}>
        {online ? 'Online' : 'Offline'}
      </span>
      <span>· last seen {timeAgo(lastSeenTs)}</span>
    </div>
  )
}
