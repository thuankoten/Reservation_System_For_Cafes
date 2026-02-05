import { useEffect, useState } from 'react'
import { useServices } from '../../../../app/ServiceContext'

export function useReservationDetailQuery({ reservationId }) {
  const { repos } = useServices()
  const [reservation, setReservation] = useState(null)
  const [lastLoadedId, setLastLoadedId] = useState('')
  const [error, setError] = useState('')

  const loading = Boolean(reservationId) && reservationId !== lastLoadedId

  useEffect(() => {
    if (!reservationId) return undefined

    const id = reservationId
    const unsub = repos.reservations.subscribeById({
      reservationId: id,
      onNext: (r) => {
        setReservation(r)
        setLastLoadedId(id)
      },
      onError: (e) => {
        setError(e?.message || 'Failed to load reservation')
        setLastLoadedId(id)
      },
    })

    return () => unsub()
  }, [repos, reservationId])

  return { reservation, loading, error }
}
