import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Tenant } from '../types'

type TenantFormState = {
  name: string
  domains: string
  enabled: boolean
  settings: string
}

const emptyForm: TenantFormState = {
  name: '',
  domains: '',
  enabled: true,
  settings: '',
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [form, setForm] = useState<TenantFormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const loadTenants = async () => {
    setLoading(true)
    try {
      const response = await api.getTenants()
      setTenants(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTenants()
  }, [])

  const tenantRows = useMemo(() => tenants, [tenants])

  const openCreate = () => {
    setEditingTenant(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (tenant: Tenant) => {
    setEditingTenant(tenant)
    setForm({
      name: tenant.name,
      domains: tenant.domains.join(', '),
      enabled: tenant.enabled,
      settings: tenant.settings || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      domains: form.domains
        .split(',')
        .map((domain) => domain.trim())
        .filter(Boolean),
      enabled: form.enabled,
      settings: form.settings.trim() || null,
    }
    try {
      if (editingTenant) {
        await api.updateTenant(editingTenant.id, payload)
      } else {
        await api.createTenant(payload)
      }
      await loadTenants()
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tenant: Tenant) => {
    const confirmed = window.confirm(`Delete tenant ${tenant.name}?`)
    if (!confirmed) return
    try {
      await api.deleteTenant(tenant.id)
      await loadTenants()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tenants</h2>
          <p className="text-sm text-slate-500">Manage tenant domains and access.</p>
        </div>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={openCreate}
        >
          Create Tenant
        </button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="rounded-lg bg-white p-6 shadow">
        {loading ? (
          <div className="text-sm text-slate-600">Loading tenants...</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Domains</th>
                  <th className="px-4 py-3">Enabled</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tenantRows.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{tenant.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {tenant.domains.map((domain) => (
                          <span
                            key={domain}
                            className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                          >
                            {domain}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          tenant.enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {tenant.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-gray-50"
                          onClick={() => openEdit(tenant)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(tenant)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <div className="text-base font-semibold text-slate-900">
              {editingTenant ? 'Edit Tenant' : 'Create Tenant'}
            </div>
            <button
              className="text-sm text-slate-500 hover:text-slate-700"
              onClick={() => setShowForm(false)}
            >
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500">Name</label>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Domains
              </label>
              <input
                value={form.domains}
                onChange={(event) => setForm({ ...form, domains: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="example.com, example.org"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Settings JSON
              </label>
              <input
                value={form.settings}
                onChange={(event) => setForm({ ...form, settings: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                id="tenant-enabled"
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="tenant-enabled" className="text-sm text-slate-700">
                Enabled
              </label>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
