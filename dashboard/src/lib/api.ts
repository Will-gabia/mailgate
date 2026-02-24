import type {
  Email,
  EmailDetail,
  Tenant,
  Rule,
  ForwardLog,
  Stats,
} from '../types'

type ApiResponse<T> = { data: T }
type PaginatedResponse<T> = { data: T[]; total: number; page: number; limit: number }


const serializeTenantPayload = (payload: Record<string, unknown>) => {
  const serialized = { ...payload }
  if (Array.isArray(serialized.domains)) {
    serialized.domains = JSON.stringify(serialized.domains)
  }
  return serialized
}

const request = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  getStats: () => request<ApiResponse<Stats>>('/api/stats'),
  getEmails: (params: {
    page?: number
    limit?: number
    status?: string
    tenantId?: string
  }) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.status) query.set('status', params.status)
    if (params.tenantId) query.set('tenantId', params.tenantId)
    return request<PaginatedResponse<Email>>(`/api/emails?${query.toString()}`)
  },
  getEmail: (id: string) => request<ApiResponse<EmailDetail>>(`/api/emails/${id}`),
  getTenants: () => request<ApiResponse<Tenant[]>>('/api/tenants'),
  getTenant: (id: string) => request<ApiResponse<Tenant>>(`/api/tenants/${id}`),
  createTenant: (payload: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<ApiResponse<Tenant>>('/api/tenants', {
      method: 'POST',
      body: JSON.stringify(serializeTenantPayload(payload)),
    }),
  updateTenant: (
    id: string,
    payload: Partial<Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>>,
  ) =>
    request<ApiResponse<Tenant>>(`/api/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(serializeTenantPayload(payload)),
    }),
  deleteTenant: (id: string) =>
    request<ApiResponse<{ id: string }>>(`/api/tenants/${id}`, { method: 'DELETE' }),
  getRules: (tenantId?: string) => {
    const query = new URLSearchParams()
    if (tenantId) query.set('tenantId', tenantId)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request<ApiResponse<Rule[]>>(`/api/rules${suffix}`)
  },
  getRule: (id: string) => request<ApiResponse<Rule>>(`/api/rules/${id}`),
  createRule: (payload: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<ApiResponse<Rule>>('/api/rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateRule: (
    id: string,
    payload: Partial<Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>>,
  ) =>
    request<ApiResponse<Rule>>(`/api/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteRule: (id: string) =>
    request<ApiResponse<{ id: string }>>(`/api/rules/${id}`, { method: 'DELETE' }),
  getForwardLogs: (params: {
    page?: number
    limit?: number
    emailId?: string
    status?: string
  }) => {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    if (params.emailId) query.set('emailId', params.emailId)
    if (params.status) query.set('status', params.status)
    return request<PaginatedResponse<ForwardLog>>(
      `/api/forward-logs?${query.toString()}`,
    )
  },
  getHealth: () => request<{ status: 'ok' }>('/api/health'),
}
