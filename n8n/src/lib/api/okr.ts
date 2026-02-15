import { api } from './config'

export type ObjectiveStatus = 'draft' | 'active' | 'completed' | 'archived'
export type ObjectiveVisibility = 'private' | 'internal' | 'public'
export type KeyResultDirection = 'increase' | 'decrease'
export type KeyResultProgressRule = 'linear' | 'ratio' | 'capped'

export interface KeyResultSnapshot {
  id: string
  org_id: string
  objective_id: string
  key_result_id: string
  metric_def_id?: string | null
  metric_key?: string | null
  start_value: number
  current_value: number
  target_value: number
  progress_percentage: number
  direction: KeyResultDirection
  progress_rule: KeyResultProgressRule
  snapshot_at: string
  created_at: string
}

export interface KeyResult {
  id: string
  objective_id: string
  description: string
  start_value: number
  target_value: number
  current_value: number
  unit?: string | null
  metric_key?: string | null
  metric_def_id?: string | null
  filters_json?: Record<string, unknown> | null
  direction?: KeyResultDirection | null
  progress_rule?: KeyResultProgressRule | null
  data_quality_requirements?: Record<string, unknown> | null
  progress_percentage?: number
  created_at?: string
  updated_at?: string | null
  deleted_at?: string | null
}

export interface OKR {
  id: string
  org_id: string
  title: string
  description?: string
  status: ObjectiveStatus
  start_date?: string | null
  due_date?: string | null
  visibility?: ObjectiveVisibility
  tags?: string[] | null
  scope_type?: string | null
  scope_ref?: string | null
  key_results: KeyResult[]
  created_at: string
  updated_at?: string | null
  deleted_at?: string | null
  overall_progress?: number
  completed_key_results?: number
  is_overdue?: boolean
}

export interface KeyResultCreate {
  description: string
  start_value?: number
  target_value: number
  current_value?: number
  unit?: string
  metric_key?: string
  metric_def_id?: string
  filters_json?: Record<string, unknown> | null
  direction?: KeyResultDirection
  progress_rule?: KeyResultProgressRule
  data_quality_requirements?: Record<string, unknown> | null
}

export interface KeyResultUpdate {
  description?: string
  start_value?: number
  target_value?: number
  current_value?: number
  unit?: string
  metric_key?: string
  metric_def_id?: string
  filters_json?: Record<string, unknown> | null
  direction?: KeyResultDirection
  progress_rule?: KeyResultProgressRule
  data_quality_requirements?: Record<string, unknown> | null
}

export interface OKRCreate {
  title: string
  description?: string
  status?: ObjectiveStatus
  start_date?: string
  due_date?: string
  visibility?: ObjectiveVisibility
  tags?: string[]
  scope_type?: string
  scope_ref?: string
  key_results?: KeyResultCreate[]
}

export interface OKRUpdate {
  title?: string
  description?: string
  status?: ObjectiveStatus
  start_date?: string
  due_date?: string
  visibility?: ObjectiveVisibility
  tags?: string[]
  scope_type?: string
  scope_ref?: string
}

interface ObjectiveListResponse {
  items: OKR[]
  total: number
  page: number
  page_size: number
}

interface SnapshotListResponse {
  items: KeyResultSnapshot[]
  total: number
  page: number
  page_size: number
}

export class OKRsAPI {
  static async list(params?: { page?: number; page_size?: number; status?: ObjectiveStatus; search?: string }): Promise<OKR[]> {
    const response = await api.get<ObjectiveListResponse>('/okrs/objectives', { params })
    return response.data.items || []
  }

  static async get(id: string): Promise<OKR> {
    const response = await api.get<OKR>(`/okrs/objectives/${id}`)
    return response.data
  }

  static async create(data: OKRCreate): Promise<OKR> {
    const response = await api.post<OKR>('/okrs/objectives', data)
    return response.data
  }

  static async update(id: string, data: OKRUpdate): Promise<OKR> {
    const response = await api.put<OKR>(`/okrs/objectives/${id}`, data)
    return response.data
  }

  static async delete(id: string): Promise<void> {
    await api.delete(`/okrs/objectives/${id}`)
  }

  static async listKeyResults(objectiveId: string): Promise<KeyResult[]> {
    const response = await api.get<KeyResult[]>(`/okrs/objectives/${objectiveId}/key-results`)
    return response.data || []
  }

  static async createKeyResult(objectiveId: string, data: KeyResultCreate): Promise<KeyResult> {
    const response = await api.post<KeyResult>(`/okrs/objectives/${objectiveId}/key-results`, data)
    return response.data
  }

  static async updateKeyResult(keyResultId: string, data: KeyResultUpdate): Promise<KeyResult> {
    const response = await api.put<KeyResult>(`/okrs/key-results/${keyResultId}`, data)
    return response.data
  }

  static async deleteKeyResult(keyResultId: string): Promise<void> {
    await api.delete(`/okrs/key-results/${keyResultId}`)
  }

  static async listObjectiveSnapshots(
    objectiveId: string,
    params?: { latest_only?: boolean; page?: number; page_size?: number }
  ): Promise<KeyResultSnapshot[]> {
    const response = await api.get<SnapshotListResponse>(`/okrs/objectives/${objectiveId}/snapshots`, { params })
    return response.data.items || []
  }

  static async listKeyResultSnapshots(
    keyResultId: string,
    params?: { page?: number; page_size?: number }
  ): Promise<KeyResultSnapshot[]> {
    const response = await api.get<SnapshotListResponse>(`/okrs/key-results/${keyResultId}/snapshots`, { params })
    return response.data.items || []
  }

  static async refreshSnapshots(params?: { objective_id?: string; min_interval_hours?: number }): Promise<{ created: number; skipped: number }> {
    const response = await api.post<{ created: number; skipped: number }>(`/okrs/snapshots/refresh`, null, { params })
    return response.data
  }
}
