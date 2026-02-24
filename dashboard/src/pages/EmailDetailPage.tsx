import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { EmailDetail } from '../types'

const statusStyles: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  classified: 'bg-indigo-100 text-indigo-700',
  forwarded: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  archived: 'bg-yellow-100 text-yellow-700',
}

const logStatusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export default function EmailDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [email, setEmail] = useState<EmailDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!id) return
      try {
        const response = await api.getEmail(id)
        if (mounted) setEmail(response.data)
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
  }, [id])

  if (loading) {
    return <div className="text-sm text-slate-600">Loading email...</div>
  }

  if (error || !email) {
    return <div className="text-sm text-red-600">{error || 'Not found'}</div>
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
      >
        Back
      </button>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              {email.subject || 'Untitled email'}
            </div>
            <div className="text-sm text-slate-500">ID {email.id}</div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusStyles[email.status]
            }`}
          >
            {email.status}
          </span>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm text-slate-700">
            <div>
              <span className="font-medium text-slate-900">From:</span>{' '}
              {email.fromHeader || email.mailFrom}
            </div>
            <div>
              <span className="font-medium text-slate-900">To:</span>{' '}
              {email.toHeader || email.rcptTo}
            </div>
            <div>
              <span className="font-medium text-slate-900">CC:</span> {email.ccHeader || '—'}
            </div>
            <div>
              <span className="font-medium text-slate-900">Date:</span>{' '}
              {email.date ? new Date(email.date).toLocaleString() : '—'}
            </div>
          </div>
          <div className="space-y-2 text-sm text-slate-700">
            <div>
              <span className="font-medium text-slate-900">Category:</span>{' '}
              {email.category || '—'}
            </div>
            <div>
              <span className="font-medium text-slate-900">Matched Rule:</span>{' '}
              {email.matchedRule || '—'}
            </div>
            <div>
              <span className="font-medium text-slate-900">Tenant:</span>{' '}
              {email.tenantId || '—'}
            </div>
            <div>
              <span className="font-medium text-slate-900">Remote IP:</span>{' '}
              {email.remoteIp}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="text-base font-semibold text-slate-900">Text Body</div>
        <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-gray-50 p-4 text-sm text-slate-700">
          {email.textBody || 'No text body available.'}
        </pre>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="text-base font-semibold text-slate-900">Attachments</div>
        <div className="mt-4 grid gap-3">
          {email.attachments.length === 0 ? (
            <div className="text-sm text-slate-500">No attachments.</div>
          ) : (
            email.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex flex-wrap items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium text-slate-900">{attachment.filename}</div>
                  <div className="text-xs text-slate-500">{attachment.contentType}</div>
                </div>
                <div className="text-xs text-slate-500">
                  {(attachment.size / 1024).toFixed(1)} KB
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="text-base font-semibold text-slate-900">Forward Logs</div>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Response</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {email.forwardLogs.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-slate-500" colSpan={4}>
                    No forward logs yet.
                  </td>
                </tr>
              ) : (
                email.forwardLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-slate-700">{log.forwardTo}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          logStatusStyles[log.status]
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.smtpResponse || log.errorMessage || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
