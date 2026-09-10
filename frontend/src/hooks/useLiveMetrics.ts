import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { MetricPoint } from '../types'

const OFFLINE_AFTER_MS = 60_000

export function useLiveMetrics(historyMinutes = 30) {
  const [latest, setLatest] = useState<MetricPoint | null>(null)
  const [history, setHistory] = useState<MetricPoint[]>([])
  const [online, setOnline] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let cancelled = false

    api
      .latest()
      .then((r) => {
        if (cancelled) return
        setLatest(r.metric)
        setOnline(r.online)
      })
      .catch(() => {})

    api
      .history(historyMinutes)
      .then((r) => {
        if (!cancelled) setHistory(r.points)
      })
      .catch(() => {})

    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}/ws/metrics`)
      wsRef.current = ws

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'metrics') {
            const point: MetricPoint = {
              ts: data.ts,
              gpus: data.gpus,
              processes: data.processes,
              host: data.host,
            }
            setLatest(point)
            setOnline(true)
            setHistory((prev) => [...prev.slice(-1000), point])
          }
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
        if (!cancelled) setTimeout(connect, 3000)
      }
    }
    connect()

    return () => {
      cancelled = true
      wsRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      if (latest && Date.now() - latest.ts * 1000 > OFFLINE_AFTER_MS) {
        setOnline(false)
      }
    }, 5000)
    return () => clearInterval(id)
  }, [latest])

  return { latest, history, online }
}
