import { createContext, useContext } from 'react'

export const ServiceContext = createContext(null)

export function useServices() {
  const ctx = useContext(ServiceContext)
  if (!ctx) throw new Error('useServices must be used within ServiceContainerProvider')
  return ctx
}
