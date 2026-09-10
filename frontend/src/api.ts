import type { Backup, LatestResponse } from './types'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  latest: () => fetch('/api/metrics/latest').then((r) => json<LatestResponse>(r)),

  history: (minutes: number) =>
    fetch(`/api/metrics/history?minutes=${minutes}`).then((r) =>
      json<{ points: (import('./types').MetricPoint)[] }>(r),
    ),

  backups: () => fetch('/api/backups').then((r) => json<{ backups: Backup[] }>(r)),

  requestBackup: () =>
    fetch('/api/backup/request', { method: 'POST' }).then((r) =>
      json<{ id: number; status: string }>(r),
    ),

  downloadBackupUrl: (id: number) => `/api/backups/${id}/download`,
}
