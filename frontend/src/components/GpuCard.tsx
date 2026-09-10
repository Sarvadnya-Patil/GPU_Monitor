import type { GpuStat } from '../types'
import { Card, Meter } from './Card'

export function GpuCard({ gpu }: { gpu: GpuStat }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          GPU {gpu.index} · {gpu.name}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{gpu.temp_c.toFixed(0)}°C</span>
      </div>

      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <Meter value={gpu.util_percent} max={100} label="Utilization" />
        <Meter value={gpu.mem_used_mb} max={gpu.mem_total_mb} label="Memory" />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 16,
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        <span>
          {(gpu.mem_used_mb / 1024).toFixed(1)} / {(gpu.mem_total_mb / 1024).toFixed(1)} GB
        </span>
        <span>{gpu.power_w.toFixed(0)} W</span>
      </div>
    </Card>
  )
}
