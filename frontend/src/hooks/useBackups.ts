import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Backup } from '../types'

export function useBackups() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [requesting, setRequesting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(() => {
    api
      .backups()
      .then((r) => setBackups(r.backups))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [refresh])

  const hasActive = backups.some((b) => b.status === 'pending' || b.status === 'running')

  useEffect(() => {
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(refresh, 2000)
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [hasActive, refresh])

  const requestBackup = useCallback(async () => {
    setRequesting(true)
    try {
      await api.requestBackup()
      refresh()
    } finally {
      setRequesting(false)
    }
  }, [refresh])

  return { backups, requesting, requestBackup }
}
