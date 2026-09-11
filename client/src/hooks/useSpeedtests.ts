import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Speedtest } from '../types'

export function useSpeedtests() {
  const [speedtests, setSpeedtests] = useState<Speedtest[]>([])
  const [requesting, setRequesting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(() => {
    api
      .speedtests()
      .then((r) => setSpeedtests(r.speedtests))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [refresh])

  const hasActive = speedtests.some((s) => s.status === 'pending' || s.status === 'running')

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

  const requestSpeedtest = useCallback(async () => {
    setRequesting(true)
    try {
      await api.requestSpeedtest()
      refresh()
    } finally {
      setRequesting(false)
    }
  }, [refresh])

  return { speedtests, requesting, requestSpeedtest }
}
