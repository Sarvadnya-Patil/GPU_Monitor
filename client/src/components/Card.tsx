import type { ReactNode } from 'react'

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: 'var(--bg)',
        padding: 20,
      }}
    >
      {title && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>{title}</div>
      )}
      {children}
    </div>
  )
}

export function Meter({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      {label && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          <span>{label}</span>
          <span>{pct.toFixed(0)}%</span>
        </div>
      )}
      <div
        style={{
          height: 6,
          borderRadius: 4,
          background: 'var(--bg-subtle)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: pct > 90 ? 'var(--bad)' : pct > 70 ? 'var(--warn)' : 'var(--accent)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  )
}
