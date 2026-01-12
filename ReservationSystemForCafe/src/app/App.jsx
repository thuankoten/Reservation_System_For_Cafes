import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './AppLayout.jsx'
import AuthPage from '../features/auth/pages/AuthPage.jsx'
import Login from '../features/auth/pages/Login.jsx'
import Signup from '../features/auth/pages/Signup.jsx'
import ForgotPassword from '../features/auth/pages/ForgotPassword.jsx'
import DashboardLayout from '../features/dashboard/layout/DashboardLayout.jsx'
import OverviewPage from '../features/dashboard/pages/OverviewPage.jsx'
import ProfilePage from '../features/dashboard/pages/ProfilePage.jsx'
import FloorPage from '../features/dashboard/pages/FloorPage.jsx'
import ChatPage from '../features/dashboard/pages/ChatPage.jsx'
import ReservationPage from '../features/dashboard/pages/ReservationPage.jsx'
import MenuPage from '../features/dashboard/pages/MenuPage.jsx'
import ReportPage from '../features/dashboard/pages/ReportPage.jsx'
import AdminDashboardLayout from '../features/admin/layout/AdminDashboardLayout.jsx'
import AdminTablesPage from '../features/admin/pages/AdminTablesPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard/overview" replace />} />

        <Route path="/auth" element={<AuthPage />}>
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
        </Route>

        <Route
          path="/dashboard"
          element={<DashboardLayout />}
        >
          <Route path="overview" element={<OverviewPage />} />
          <Route path="profile" element={<ProfilePage />} />

          <Route path="tables" element={<FloorPage />} />
          <Route path="reservations" element={<ReservationPage />} />
          <Route path="menu" element={<MenuPage />} />
          <Route path="chat" element={<ChatPage />} />

          <Route path="report" element={<ReportPage />} />

          <Route path="floor" element={<Navigate to="/dashboard/tables" replace />} />
          <Route path="reservation" element={<Navigate to="/dashboard/reservations" replace />} />
          <Route index element={<Navigate to="overview" replace />} />
        </Route>

        <Route path="/admin/dashboard" element={<AdminDashboardLayout />}>
          <Route path="tables" element={<AdminTablesPage />} />
          <Route index element={<Navigate to="tables" replace />} />
        </Route>

        <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />

        <Route path="*" element={<Navigate to="/dashboard/overview" replace />} />
      </Route>
    </Routes>
  )
}
