import { Outlet } from 'react-router-dom'
import Sidebar from '../../../shared/components/Sidebar.jsx'

export default function DashboardLayout() {
  return (
    <div className="dashboardShell">
      <Sidebar
        role="Customer"
        items={[
          { to: '/dashboard/overview', label: 'Overview' },
          { to: '/dashboard/tables', label: 'Tables' },
          { to: '/dashboard/reservations', label: 'Reservations' },
          { to: '/dashboard/menu', label: 'Menu' },
          { to: '/dashboard/chat', label: 'Chat' },
          { to: '/dashboard/report', label: 'Report' },
        ]}
      />

      <section className="dashboardShell__content">
        <Outlet />
      </section>
    </div>
  )
}
