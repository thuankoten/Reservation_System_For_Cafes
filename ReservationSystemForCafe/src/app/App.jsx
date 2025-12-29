import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './AppLayout.jsx'
import AuthPage from '../features/auth/pages/AuthPage.jsx'
import Login from '../features/auth/pages/Login.jsx'
import DashboardLayout from '../features/dashboard/layout/DashboardLayout.jsx'
import OverviewPage from '../features/dashboard/pages/OverviewPage.jsx'
import ProfilePage from '../features/dashboard/pages/ProfilePage.jsx'
import FloorPage from '../features/dashboard/pages/FloorPage.jsx'
import ChatPage from '../features/dashboard/pages/ChatPage.jsx'
import ReservationPage from '../features/dashboard/pages/ReservationPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard/overview" replace />} />

        <Route path="/auth" element={<AuthPage />}>
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Login />} />
        </Route>

        <Route
          path="/dashboard"
          element={<DashboardLayout />}
        >
          <Route path="overview" element={<OverviewPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="floor" element={<FloorPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="reservation" element={<ReservationPage />} />
          <Route index element={<Navigate to="overview" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard/overview" replace />} />
      </Route>
    </Routes>
  )
}
