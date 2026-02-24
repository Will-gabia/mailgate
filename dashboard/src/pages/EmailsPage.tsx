import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Email } from '../types'

const statusOptions = ['all', 'received', 'classified', 'forwarded', 'failed', 'archived']

const statusStyles: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  classified: 'bg-indigo-100 text-indigo-700',
  forwarded: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  archived: 'bg-yellow-100 text-yellow-700',
}

export default function EmailsPage() {
  const navigate = useNavigate()
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
        const response = await api.getEmails({
          page,
          limit,
          status: status === 'all' ? undefined : status,
        })
        if (mounted) {
          setEmails(response.data)
          setTotal(response.total)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Emails</h2>
          <p className="text-sm text-slate-500">Track inbound mail status and details.</p>
        </div>
        <div className="flex items-center gap-3">
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
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        {loading ? (
          <div className="text-sm text-slate-600">Loading emails...</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {emails.map((email) => (
                  <tr
                    key={email.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/emails/${email.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {email.subject || 'Untitled'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {email.fromHeader || email.mailFrom}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{email.toHeader || email.rcptTo}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          statusStyles[email.status]
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
