import { NavLink, Outlet } from 'react-router-dom'

function SideItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `sideItem ${isActive ? 'sideItem--active' : ''}`}
    >
      {label}
    </NavLink>
  )
}

export default function DashboardLayout() {
  return (
    <div className="dashboard">
      <section className="dashboard__content">
        <Outlet />
      </section>

      <aside className="dashboard__sidebar">
        <div className="sidebarCard">
          <div className="sidebarCard__title">Dashboard</div>
          <div className="sidebarCard__nav">
            <SideItem to="/dashboard/overview" label="Overview" />
            <SideItem to="/dashboard/profile" label="Profile" />
            <SideItem to="/dashboard/floor" label="Floor" />
            <SideItem to="/dashboard/chat" label="Chat" />
            <SideItem to="/dashboard/reservation" label="Reservation" />
          </div>
        </div>
      </aside>
    </div>
  )
}
