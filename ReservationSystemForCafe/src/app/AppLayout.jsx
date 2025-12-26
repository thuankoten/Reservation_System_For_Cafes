import { Outlet } from 'react-router-dom'
import TopBar from './TopBar.jsx'

export default function AppLayout() {
  return (
    <div className="appShell">
      <TopBar />
      <main className="appShell__main">
        <Outlet />
      </main>
    </div>
  )
}
