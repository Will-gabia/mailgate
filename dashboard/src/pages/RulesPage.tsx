import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Rule, Tenant } from '../types'

type RuleFormState = {
  name: string
  description: string
  priority: string
  enabled: boolean
  conditions: string
  action: string
  forwardTo: string
  category: string
  tenantId: string
}

const emptyForm: RuleFormState = {
  name: '',
  description: '',
  priority: '0',
  enabled: true,
  conditions: '[]',
  action: 'forward',
  forwardTo: '',
  category: '',
  tenantId: '',
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tenantFilter, setTenantFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [form, setForm] = useState<RuleFormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const loadData = async (tenantId?: string) => {
    setLoading(true)
    try {
      const [rulesResponse, tenantsResponse] = await Promise.all([
        api.getRules(tenantId),
        api.getTenants(),
      ])
      setRules(rulesResponse.data)
      setTenants(tenantsResponse.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(tenantFilter === 'all' ? undefined : tenantFilter)
  }, [tenantFilter])

  const tenantMap = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenant.name])),
    [tenants],
  )

  const openCreate = () => {
    setEditingRule(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (rule: Rule) => {
    setEditingRule(rule)
    setForm({
      name: rule.name,
      description: rule.description || '',
      priority: String(rule.priority),
      enabled: rule.enabled,
      conditions: rule.conditions,
      action: rule.action,
      forwardTo: rule.forwardTo || '',
      category: rule.category || '',
      tenantId: rule.tenantId || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      priority: Number(form.priority || 0),
      enabled: form.enabled,
      conditions: form.conditions.trim() || '[]',
      action: form.action.trim() || 'forward',
      forwardTo: form.forwardTo.trim() || null,
      category: form.category.trim() || null,
      tenantId: form.tenantId || null,
    }
    try {
      if (editingRule) {
        await api.updateRule(editingRule.id, payload)
      } else {
        await api.createRule(payload)
      }
      await loadData(tenantFilter === 'all' ? undefined : tenantFilter)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (rule: Rule) => {
    const confirmed = window.confirm(`Delete rule ${rule.name}?`)
    if (!confirmed) return
    try {
      await api.deleteRule(rule.id)
      await loadData(tenantFilter === 'all' ? undefined : tenantFilter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Rules</h2>
          <p className="text-sm text-slate-500">Configure classification and routing rules.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={tenantFilter}
            onChange={(event) => setTenantFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All tenants</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={openCreate}
          >
            Create Rule
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="rounded-lg bg-white p-6 shadow">
        {loading ? (
          <div className="text-sm text-slate-600">Loading rules...</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Forward To</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Enabled</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{rule.name}</div>
                      <div className="text-xs text-slate-500">{rule.conditions}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{rule.priority}</td>
                    <td className="px-4 py-3 text-slate-700">{rule.action}</td>
                    <td className="px-4 py-3 text-slate-700">{rule.forwardTo || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {rule.tenantId ? tenantMap.get(rule.tenantId) || rule.tenantId : 'Global'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          rule.enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-gray-50"
                          onClick={() => openEdit(rule)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(rule)}
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
              {editingRule ? 'Edit Rule' : 'Create Rule'}
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
                Description
              </label>
              <input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Priority
              </label>
              <input
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                type="number"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500">Action</label>
              <select
                value={form.action}
                onChange={(event) => setForm({ ...form, action: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="forward">forward</option>
                <option value="log">log</option>
                <option value="archive">archive</option>
                <option value="reject">reject</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Forward To
              </label>
              <input
                value={form.forwardTo}
                onChange={(event) => setForm({ ...form, forwardTo: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Category
              </label>
              <input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500">Tenant</label>
              <select
                value={form.tenantId}
                onChange={(event) => setForm({ ...form, tenantId: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Global</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase text-slate-500">
                Conditions JSON
              </label>
              <textarea
                value={form.conditions}
                onChange={(event) => setForm({ ...form, conditions: event.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                id="rule-enabled"
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="rule-enabled" className="text-sm text-slate-700">
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
