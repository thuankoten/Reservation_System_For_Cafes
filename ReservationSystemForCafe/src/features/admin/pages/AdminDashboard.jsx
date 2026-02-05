import { useMemo } from 'react'
import { useTablesQuery } from '../../../modules/tables/application/queries/useTablesQuery'
import { useReservationsQuery } from '../../../modules/reservations/application/queries/useReservationsQuery'

function toDate(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  try { return new Date(v) } catch { return null }
}

export default function AdminDashboard() {
  const { rows: tables } = useTablesQuery()
  const { rows: reservations } = useReservationsQuery({ orderByField: 'createdAt', orderByDirection: 'desc', limitCount: 50 })

  const stats = useMemo(() => {
    const totalTables = tables.length
    let available = 0, occupied = 0
    for (const t of tables) {
      const st = String(t.status || 'available').toLowerCase()
      if (st === 'occupied') occupied += 1
      else available += 1
    }

    const now = new Date()
    const todayIso = now.toISOString().slice(0,10)
    let pending = 0, todayCount = 0, upcoming = 0
    for (const r of reservations) {
      const s = String(r.status || '').toLowerCase()
      if (s === 'hold') pending += 1
      const start = toDate(r.startTime)
      if (!start) continue
      const iso = start.toISOString().slice(0,10)
      if (iso === todayIso) todayCount += 1
      else if (start > now) upcoming += 1
    }

    return { totalTables, available, occupied, pending, todayCount, upcoming }
  }, [tables, reservations])

  const todayCreated = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10)
    const list = reservations.filter((r) => {
      const c = toDate(r.createdAt)
      return c && c.toISOString().slice(0, 10) === todayIso
    })
    list.sort((a, b) => {
      const ta = toDate(a.createdAt)?.getTime?.() || 0
      const tb = toDate(b.createdAt)?.getTime?.() || 0
      return tb - ta
    })
    return list
  }, [reservations])

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h2 className="pageTitle" style={{ margin: 0 }}>Dashboard</h2>
        <div className="muted">{new Date().toLocaleString()}</div>
      </div>

      <div className="split">
        <div className="card" style={{ minWidth: 220 }}>
          <div className="muted">Total tables</div>
          <div className="bigNumber">{stats.totalTables}</div>
        </div>
        <div className="card" style={{ minWidth: 220 }}>
          <div className="muted">Available</div>
          <div className="bigNumber">{stats.available}</div>
        </div>
        <div className="card" style={{ minWidth: 220 }}>
          <div className="muted">Occupied</div>
          <div className="bigNumber">{stats.occupied}</div>
        </div>
      </div>

      <div className="card">
        <div className="miniCard__title">Reservations created today</div>
        <div className="stack" style={{ marginTop: 8 }}>
          {todayCreated.length === 0 ? (
            <div className="muted">No reservations created today.</div>
          ) : (
            todayCreated.map((r) => {
              const created = toDate(r.createdAt)
              const start = toDate(r.startTime)
              const label = r.customerName || r.userEmail || '—'
              return (
                <div key={r.id} className="miniCard" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="tile__title">{label}</div>
                    <div className="muted">Table {r.tableNumber || r.tableId} • {r.status}</div>
                    {start ? <div className="muted">Start: {start.toLocaleString()}</div> : null}
                  </div>
                  <div className="muted">Created: {created ? created.toLocaleTimeString() : '—'}</div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}