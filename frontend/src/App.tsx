import { BackupPanel } from './components/BackupPanel'
import { GpuCard } from './components/GpuCard'
import { HostCard } from './components/HostCard'
import { ProcessesTable } from './components/ProcessesTable'
import { StatusBar } from './components/StatusBar'
import { UtilChart } from './components/UtilChart'
import { useLiveMetrics } from './hooks/useLiveMetrics'

export default function App() {
  const { latest, history, online } = useLiveMetrics(30)

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px 80px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>GPU Monitor</h1>
        <StatusBar online={online} lastSeenTs={latest?.ts ?? null} />
      </header>

      {!latest ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Waiting for data…</div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 20,
            }}
          >
            {latest.gpus.map((gpu) => (
              <GpuCard key={gpu.index} gpu={gpu} />
            ))}
            <HostCard host={latest.host} />
          </div>

          <UtilChart history={history} />

          <ProcessesTable processes={latest.processes} />

          <BackupPanel />
        </div>
      )}
    </div>
  )
}
