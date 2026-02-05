import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthContext.jsx'
import { ServiceContainerProvider } from './ServiceContainer.jsx'

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ServiceContainerProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </ServiceContainerProvider>
    </AuthProvider>
  )
}
