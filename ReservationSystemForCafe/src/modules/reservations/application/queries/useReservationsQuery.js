import { useEffect, useState } from 'react'
import { useServices } from '../../../../app/ServiceContext'

export function useReservationsQuery({ orderByField, orderByDirection, limitCount } = {}) {
  const { repos } = useServices()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const unsub = repos.reservations.subscribeAll({
      onNext: setRows,
      onError: (e) => setError(e?.message || 'Failed to load reservations'),
      orderByField,
      orderByDirection,
      limitCount,
    })
    return () => unsub()
  }, [repos, orderByField, orderByDirection, limitCount])

  return { rows, error }
}
