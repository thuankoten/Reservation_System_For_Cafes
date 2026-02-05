import { useEffect, useState } from 'react'
import { useServices } from '../../../../app/ServiceContext'

const EMPTY_ROWS = []

export function useMyReservationsQuery({ userId }) {
  const { repos } = useServices()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  const effectiveRows = userId ? rows : EMPTY_ROWS

  useEffect(() => {
    if (!userId) return undefined

    const unsub = repos.reservations.subscribeByUserId({
      userId,
      onNext: setRows,
      onError: (e) => setError(e?.message || 'Failed to load reservations'),
    })

    return () => unsub()
  }, [repos, userId])

  return { rows: effectiveRows, error }
}
