import type { HostStat } from '../types'
import { Card, Meter } from './Card'

export function HostCard({ host }: { host: HostStat }) {
  return (
    <Card title="Host">
      <div style={{ display: 'grid', gap: 14 }}>
        <Meter value={host.cpu_percent} max={100} label="CPU" />
        <Meter value={host.ram_used_gb} max={host.ram_total_gb} label="RAM" />
        <Meter value={host.disk_used_gb} max={host.disk_total_gb} label="Disk" />
      </div>
      <div style={{ display: 'grid', gap: 4, marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>
          RAM {host.ram_used_gb.toFixed(1)} / {host.ram_total_gb.toFixed(1)} GB
        </span>
        <span>
          Disk {host.disk_used_gb.toFixed(0)} / {host.disk_total_gb.toFixed(0)} GB
        </span>
      </div>
    </Card>
  )
}
