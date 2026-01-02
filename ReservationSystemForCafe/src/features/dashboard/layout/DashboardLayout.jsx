import { NavLink, Outlet } from 'react-router-dom'

function SideItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `sideItem sideItem--left ${isActive ? 'sideItem--active' : ''}`}
    >
      {label}
    </NavLink>
  )
}

export default function DashboardLayout() {
  return (
    <div className="dashboardShell">
      <aside className="leftSidebar">
        <div className="leftSidebar__brand">
          <div className="leftSidebar__logo" />
          <div className="leftSidebar__name">CAFÉ</div>
        </div>

        <nav className="leftSidebar__nav">
          <SideItem to="/dashboard/overview" label="Overview" />
          <SideItem to="/dashboard/tables" label="Tables" />
          <SideItem to="/dashboard/reservations" label="Reservations" />
          <SideItem to="/dashboard/menu" label="Menu" />
          <SideItem to="/dashboard/chat" label="Chat" />
          <SideItem to="/dashboard/report" label="Report" />
        </nav>

        <div className="leftSidebar__bottom">
          <div className="leftSidebar__avatar" />
        </div>
      </aside>

      <section className="dashboardShell__content">
        <Outlet />
      </section>
    </div>
  )
}
