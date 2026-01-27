import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.jsx'
import AppProviders from './app/providers.jsx'
import { setupGlobalErrorAlerts } from './shared/utils/errorAlert.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)

// Setup global error alert handlers (skip on auth routes)
setupGlobalErrorAlerts()
