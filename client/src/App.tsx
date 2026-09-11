import { useEffect, useState } from 'react'
import { api, UNAUTHORIZED_EVENT } from './api'
import { BackupPanel } from './components/BackupPanel'
import { GpuCard } from './components/GpuCard'
import { HostCard } from './components/HostCard'
import { LoginPage } from './components/LoginPage'
import { PairingPanel } from './components/PairingPanel'
import { ProcessesTable } from './components/ProcessesTable'
import { StatusBar } from './components/StatusBar'
import { UtilChart } from './components/UtilChart'
import { useLiveMetrics } from './hooks/useLiveMetrics'

function Dashboard({ authEnabled, onLoggedOut }: { authEnabled: boolean; onLoggedOut: () => void }) {
  const { latest, history, online } = useLiveMetrics(30)

  const logout = async () => {
    await api.logout()
    onLoggedOut()
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <StatusBar online={online} lastSeenTs={latest?.ts ?? null} />
          {authEnabled && (
            <button
              onClick={logout}
              style={{
                border: '1px solid var(--border)',
                background: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      {!latest ? (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Waiting for data…</div>
          <PairingPanel />
        </div>
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

          <PairingPanel />
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [status, setStatus] = useState<{ enabled: boolean; authenticated: boolean } | null>(null)

  const refreshAuth = () => {
    api
      .authStatus()
      .then(setStatus)
      .catch(() => setStatus({ enabled: true, authenticated: false }))
  }

  useEffect(() => {
    refreshAuth()
    const onUnauthorized = () => setStatus((s) => (s ? { ...s, authenticated: false } : s))
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  if (!status) return null

  if (status.enabled && !status.authenticated) {
    return <LoginPage onLoggedIn={refreshAuth} />
  }

  return <Dashboard authEnabled={status.enabled} onLoggedOut={refreshAuth} />
}
