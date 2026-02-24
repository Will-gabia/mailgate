import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import EmailsPage from './pages/EmailsPage'
import EmailDetailPage from './pages/EmailDetailPage'
import TenantsPage from './pages/TenantsPage'
import RulesPage from './pages/RulesPage'
import ForwardLogsPage from './pages/ForwardLogsPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/emails" element={<EmailsPage />} />
        <Route path="/emails/:id" element={<EmailDetailPage />} />
        <Route path="/tenants" element={<TenantsPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/forward-logs" element={<ForwardLogsPage />} />
      </Routes>
    </Layout>
  )
}
