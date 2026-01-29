import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AppLayout from './AppLayout.jsx'
import AuthPage from '../features/auth/pages/AuthPage.jsx'
import Login from '../features/auth/pages/Login.jsx'
import AdminLogin from '../features/auth/pages/AdminLogin.jsx'
import Signup from '../features/auth/pages/Signup.jsx'
import ForgotPassword from '../features/auth/pages/ForgotPassword.jsx'
import DashboardLayout from '../features/dashboard/layout/DashboardLayout.jsx'
import OverviewPage from '../features/dashboard/pages/OverviewPage.jsx'
import ProfilePage from '../features/dashboard/pages/ProfilePage.jsx'
import FloorPage from '../features/dashboard/pages/FloorPage.jsx'
import ReservationPage from '../features/dashboard/pages/ReservationPage.jsx'
import InstructionsPage from '../features/dashboard/pages/InstructionsPage.jsx'
import AdminDashboardLayout from '../features/admin/layout/AdminDashboardLayout.jsx'
import AdminTablesPage from '../features/admin/pages/AdminTablesPage.jsx'
import AdminCreateTablePage from '../features/admin/pages/AdminCreateTablePage.jsx'
import AdminAccountsPage from '../features/admin/pages/AdminAccountsPage.jsx'
import RequireAuth from '../features/auth/RequireAuth.jsx'
import AdminReservationPage from '../features/admin/pages/AdminReservationPage.jsx'
import AdminReservationDetailPage from '../features/admin/pages/AdminReservationDetailPage.jsx'
import AdminDashboard from '../features/admin/pages/AdminDashboard.jsx'

export default function App() {
  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard/overview" replace />} />
          <Route path="/auth" element={<AuthPage />}>
            <Route path="login" element={<Login />} />
            <Route path="admin-login" element={<AdminLogin />} />
            <Route path="signup" element={<Signup />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
          </Route>

          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route path="overview" element={<OverviewPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="tables" element={<FloorPage />} />
            <Route path="reservations" element={<ReservationPage />} />
            <Route path="instructions" element={<InstructionsPage />} />
            {/* Chat/Report removed */}
            <Route index element={<Navigate to="overview" replace />} />
          </Route>

          <Route path="/admin/dashboard" element={
            <RequireAuth allowedRoles={['admin', 'system-admin']}>
              <AdminDashboardLayout />
            </RequireAuth>
          }>
            <Route path="overview" element={<AdminDashboard />} />
            <Route path="tables" element={<AdminTablesPage />} />
            <Route path="tables/new" element={<AdminCreateTablePage />} />
            <Route path="accounts" element={<AdminAccountsPage />} />
            <Route path="reservations" element={<AdminReservationPage />} />
            <Route path="reservations/:reservationId" element={<AdminReservationDetailPage />}/>
            <Route index element={<Navigate to="overview" replace />} />
          </Route>

          <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  )
}