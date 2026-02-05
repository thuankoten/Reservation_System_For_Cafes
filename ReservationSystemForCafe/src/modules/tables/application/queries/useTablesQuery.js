import { useEffect, useState } from 'react'
import { useServices } from '../../../../app/ServiceContext'

export function useTablesQuery() {
  const { repos } = useServices()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsub = repos.tables.subscribeAll({
      onNext: (next) => {
        setRows(next)
        setLoading(false)
      },
      onError: (e) => {
        setError(e?.message || 'Failed to load tables')
        setLoading(false)
      },
    })

    return () => unsub()
  }, [repos])

  return { rows, loading, error }
}
