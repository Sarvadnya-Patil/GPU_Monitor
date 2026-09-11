import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MetricPoint } from '../types'
import { Card } from './Card'

export function UtilChart({ history }: { history: MetricPoint[] }) {
  const data = history.map((p) => ({
    time: new Date(p.ts * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    util: p.gpus[0]?.util_percent ?? 0,
  }))

  return (
    <Card title="GPU utilization (last 5 min)">
      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="utilFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#171717" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#171717" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: '#737373' }}
              axisLine={{ stroke: '#e5e5e5' }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#737373' }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
              formatter={(v) => [`${Number(v).toFixed(0)}%`, 'Utilization']}
            />
            <Area type="monotone" dataKey="util" stroke="#171717" strokeWidth={1.5} fill="url(#utilFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
