import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthContext.jsx'

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <BrowserRouter>{children}</BrowserRouter>
    </AuthProvider>
  )
}
