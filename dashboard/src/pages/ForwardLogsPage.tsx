import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Email, ForwardLog } from '../types'

type ForwardLogRow = ForwardLog & { emailSubject: string }

const statusOptions = ['all', 'pending', 'success', 'failed']

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export default function ForwardLogsPage() {
  const [logs, setLogs] = useState<ForwardLog[]>([])
  const [emails, setEmails] = useState<Email[]>([])
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const [logsResponse, emailsResponse] = await Promise.all([
          api.getForwardLogs({
            page,
            limit,
            status: status === 'all' ? undefined : status,
          }),
          api.getEmails({ page: 1, limit: 100 }),
        ])
        if (mounted) {
          setLogs(logsResponse.data)
          setTotal(logsResponse.total)
          setEmails(emailsResponse.data)
        }
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
  }, [page, limit, status])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const emailMap = useMemo(
    () => new Map(emails.map((email) => [email.id, email.subject || 'Untitled'])),
    [emails],
  )

  const rows: ForwardLogRow[] = logs.map((log) => ({
    ...log,
    emailSubject: emailMap.get(log.emailId) || log.emailId,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Forward Logs</h2>
          <p className="text-sm text-slate-500">Inspect delivery attempts and outcomes.</p>
        </div>
        <select
          value={status}
          onChange={(event) => {
            setPage(1)
            setStatus(event.target.value)
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        {loading ? (
          <div className="text-sm text-slate-600">Loading forward logs...</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Email Subject</th>
                  <th className="px-4 py-3">Forward To</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {log.emailSubject}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.forwardTo}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          statusStyles[log.status]
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.attempts}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Prev
            </button>
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
