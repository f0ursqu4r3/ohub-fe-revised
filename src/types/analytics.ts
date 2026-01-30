export interface ComplianceFields {
  total: number
  customer_count_present: number
  cause_present: number
  outage_type_present: number
  is_planned_present: number
  outage_start_present: number
  etr_present: number
  polygon_present: number
  computed_at: string
}

export interface ComplianceSummary extends ComplianceFields {
  provider: string
  granularity: string
  window_start_ts: number
  window_end_ts: number
}

export interface ComplianceBucket extends ComplianceFields {
  provider: string
  granularity: string
  bucket_start_ts: number
  bucket_end_ts: number
  fetch_ts_max: number
}

export interface ProviderSummary {
  provider: string
  summary: ComplianceSummary | null
}

export interface WorkerRun {
  id: number
  started_at: string
  finished_at: string
  processed_buckets: number
  skipped_buckets: number
  elapsed_ms: number
  bucket_ms_min: number
  bucket_ms_max: number
  bucket_ms_avg: number
  errors: number
  last_error: string | null
  budget: number
  interval_secs: number
}

export interface ProvidersResponse {
  providers: ProviderSummary[]
  allSummary: ComplianceSummary | null
}

export type Granularity = 'day' | 'week' | 'month'
