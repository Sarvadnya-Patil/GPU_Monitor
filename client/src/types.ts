export interface AuthStatus {
  enabled: boolean
  authenticated: boolean
}

export interface GpuStat {
  index: number
  name: string
  util_percent: number
  mem_used_mb: number
  mem_total_mb: number
  temp_c: number
  power_w: number
}

export interface ProcessStat {
  pid: number
  name: string
  gpu_index: number
  mem_mb: number
}

export interface HostStat {
  cpu_percent: number
  ram_used_gb: number
  ram_total_gb: number
  disk_used_gb: number
  disk_total_gb: number
}

export interface MetricPayload {
  gpus: GpuStat[]
  processes: ProcessStat[]
  host: HostStat
}

export interface MetricPoint extends MetricPayload {
  ts: number
}

export interface LatestResponse {
  online: boolean
  seconds_since_last_seen?: number
  metric: MetricPoint | null
}

export type BackupStatus = 'pending' | 'running' | 'done' | 'failed'

export interface Backup {
  id: number
  requested_at: number
  completed_at: number | null
  status: BackupStatus
  filename: string | null
  size_bytes: number | null
  error: string | null
  extra_paths: string[]
}
