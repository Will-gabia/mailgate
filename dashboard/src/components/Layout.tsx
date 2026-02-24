import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/emails', label: 'Emails', icon: '✉️' },
  { to: '/tenants', label: 'Tenants', icon: '🏢' },
  { to: '/rules', label: 'Rules', icon: '🧩' },
  { to: '/forward-logs', label: 'Forward Logs', icon: '📬' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-slate-700 text-white'
      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
  }`

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 px-4 py-6">
        <div className="mb-8 px-2 text-lg font-semibold tracking-wide text-white">
          Mail Gateway
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
              <span className="text-lg" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="ml-64 flex min-h-screen flex-col">
        <header className="flex h-16 items-center border-b border-slate-200 bg-white px-8">
          <h1 className="text-xl font-semibold text-slate-900">Mail Gateway</h1>
        </header>
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  )
}
