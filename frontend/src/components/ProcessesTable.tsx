import type { ProcessStat } from '../types'
import { Card } from './Card'

export function ProcessesTable({ processes }: { processes: ProcessStat[] }) {
  return (
    <Card title="GPU processes">
      {processes.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No processes running</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ fontWeight: 500, paddingBottom: 8 }}>PID</th>
              <th style={{ fontWeight: 500, paddingBottom: 8 }}>Name</th>
              <th style={{ fontWeight: 500, paddingBottom: 8 }}>GPU</th>
              <th style={{ fontWeight: 500, paddingBottom: 8, textAlign: 'right' }}>Memory</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => (
              <tr key={p.pid} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 0' }}>{p.pid}</td>
                <td style={{ padding: '8px 0' }}>{p.name}</td>
                <td style={{ padding: '8px 0' }}>{p.gpu_index}</td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>{p.mem_mb.toFixed(0)} MB</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
