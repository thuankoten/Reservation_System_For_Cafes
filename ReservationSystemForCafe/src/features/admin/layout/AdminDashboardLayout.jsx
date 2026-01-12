import { Outlet } from 'react-router-dom'
import Sidebar from '../../../shared/components/Sidebar.jsx'

export default function AdminDashboardLayout() {
  return (
    <div className="dashboardShell">
      <Sidebar role="Administrator" items={[{ to: '/admin/dashboard/tables', label: 'Tables' }]} />

      <section className="dashboardShell__content">
        <Outlet />
      </section>
    </div>
  )
}
