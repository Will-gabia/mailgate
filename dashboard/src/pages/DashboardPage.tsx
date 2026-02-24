import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Stats } from '../types'

const statusStyles: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  classified: 'bg-indigo-100 text-indigo-700',
  forwarded: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  archived: 'bg-yellow-100 text-yellow-700',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const response = await api.getStats()
        if (mounted) setStats(response.data)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return <div className="text-sm text-slate-600">Loading dashboard...</div>
  }

  if (error || !stats) {
    return <div className="text-sm text-red-600">{error || 'No data'}</div>
  }

  const statusKeys = ['received', 'classified', 'forwarded', 'failed', 'archived']

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm text-slate-500">Total Emails</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">
            {stats.totalEmails}
          </div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm text-slate-500">Emails Today</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">
            {stats.emailsToday}
          </div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm text-slate-500">Tenants</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">
            {stats.totalTenants}
          </div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="text-sm text-slate-500">Rules</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">
            {stats.totalRules}
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="text-base font-semibold text-slate-900">Status Breakdown</div>
        <div className="mt-4 flex flex-wrap gap-3">
          {statusKeys.map((status) => (
            <span
              key={status}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusStyles[status]
              }`}
            >
              {status} · {stats.emailsByStatus?.[status] ?? 0}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">Recent Emails</div>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stats.recentEmails.slice(0, 5).map((email) => (
                <tr key={email.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {email.subject || 'Untitled'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {email.fromHeader || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        statusStyles[email.status] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {email.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(email.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
