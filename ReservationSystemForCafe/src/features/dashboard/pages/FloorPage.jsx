import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../../shared/firebase'
import { useAuth } from '../../auth/AuthContext.jsx'

export default function FloorPage() {
  useAuth()
  const [tables, setTables] = useState([])
  const [activeView, setActiveView] = useState('map')
  const [activeStatus, setActiveStatus] = useState('all')
  const [activeFloor, setActiveFloor] = useState(1)
  const [error, setError] = useState('')
  const [reservations, setReservations] = useState([])
  const [reservationsError, setReservationsError] = useState('')

  useEffect(() => {
    setError('')
    const qTables = query(collection(db, 'tables'), orderBy('number', 'asc'))
    const unsub = onSnapshot(
      qTables,
      (snap) => {
        setTables(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      },
      (e) => setError(e?.message || 'Failed to load tables')
    )

    return () => unsub()
  }, [])

  useEffect(() => {
    setReservationsError('')
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'), limit(100))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setReservations(rows)
      },
      (e) => setReservationsError(e?.message || 'Failed to load reservations')
    )

    return () => unsub()
  }, [])

  const normalizedStatus = (s) => {
    const v = String(s || '').trim().toLowerCase()
    if (!v) return 'free'
    if (v === 'available') return 'free'
    if (v === 'free') return 'free'
    if (v === 'reserved') return 'reserved'
    if (v === 'occupied') return 'occupied'
    return v
  }

  const toDate = (v) => {
    if (!v) return null
    if (typeof v?.toDate === 'function') return v.toDate()
    try {
      return new Date(v)
    } catch {
      return null
    }
  }

  const formatTime = (d) => {
    if (!d) return '—'
    try {
      return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d)
    } catch {
      return d.toISOString?.() || String(d)
    }
  }

  const now = new Date()
  const activeReservations = reservations
    .map((r) => {
      const status = String(r.status || '').toLowerCase()
      const startTimeDate = toDate(r.startTime)
      const holdExpiresAt = toDate(r.holdExpiresAt)
      return { ...r, _status: status, startTimeDate, _holdExpiresAt: holdExpiresAt }
    })
    .filter((r) => {
      if (r._status === 'confirmed') return true
      if (r._status === 'hold') return r._holdExpiresAt && r._holdExpiresAt > now
      return false
    })

  const reservationByTableId = new Map()
  for (const r of activeReservations) {
    if (!r.tableId) continue
    if (!reservationByTableId.has(r.tableId)) reservationByTableId.set(r.tableId, r)
  }

  const filteredTables = tables.filter((t) => {
    const status = normalizedStatus(t.status)
    const hasReservation = reservationByTableId.has(t.id)

    const effectiveStatus = hasReservation ? 'reserved' : status
    if (activeStatus === 'all') return true
    return effectiveStatus === activeStatus
  })

  const floorIdForTable = (t) => {
    const explicit = Number(t?.floor)
    if (explicit === 1 || explicit === 2 || explicit === 3) return explicit

    const n = Number(t?.number)
    if (!Number.isFinite(n) || n <= 0) return 1
    const maxNumber = Math.max(1, ...tables.map((x) => Number(x?.number) || 0))
    const perFloor = Math.max(1, Math.ceil(maxNumber / 3))
    return Math.min(3, Math.max(1, Math.ceil(n / perFloor)))
  }

  const mapTables = filteredTables
    .filter((t) => floorIdForTable(t) === activeFloor)
    .slice()
    .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))

  const mapCount = mapTables.length
  const mapCols = (() => {
    if (mapCount <= 1) return 1
    if (mapCount <= 3) return mapCount
    if (mapCount <= 6) return 3
    if (mapCount === 9) return 3
    return 4
  })()
  const mapRows = Math.max(1, Math.ceil(mapCount / mapCols))

  const filteredReservations = activeReservations.filter((r) => {
    if (activeStatus === 'all') return true
    if (activeStatus === 'reserved') return true
    return false
  })

  const groupedByCustomer = filteredReservations.reduce((acc, r) => {
    const key = r.userEmail || r.userId || 'Guest'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  const customerKeys = Object.keys(groupedByCustomer).sort((a, b) => a.localeCompare(b))

  return (
    <div className={activeView === 'map' ? 'card tablesCard tablesCard--map' : 'card'}>
      <div className="tablesTop">
        <div className="tablesTop__tabs" role="tablist" aria-label="Tables views">
          <button
            type="button"
            className={`tabBtn ${activeView === 'map' ? 'tabBtn--active' : ''}`}
            onClick={() => setActiveView('map')}
          >
            Table Map
          </button>
          <button
            type="button"
            className={`tabBtn ${activeView === 'byCustomer' ? 'tabBtn--active' : ''}`}
            onClick={() => setActiveView('byCustomer')}
          >
            Table by Customer
          </button>
          <button
            type="button"
            className={`tabBtn ${activeView === 'timeline' ? 'tabBtn--active' : ''}`}
            onClick={() => setActiveView('timeline')}
          >
            TimeLine
          </button>
        </div>

        <div className="tablesTop__meta">
          <h2 className="pageTitle">Tables</h2>
          <div className="muted">Realtime view of tables</div>
        </div>
      </div>

      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {reservationsError ? <div className="error" style={{ marginTop: 12 }}>{reservationsError}</div> : null}

      <div className="tablesFilters" aria-label="Tables status filter">
        <button
          type="button"
          className={`chip ${activeStatus === 'all' ? 'chip--active' : ''}`}
          onClick={() => setActiveStatus('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`chip ${activeStatus === 'free' ? 'chip--active' : ''}`}
          onClick={() => setActiveStatus('free')}
        >
          Free
        </button>
        <button
          type="button"
          className={`chip ${activeStatus === 'reserved' ? 'chip--active' : ''}`}
          onClick={() => setActiveStatus('reserved')}
        >
          Reserved
        </button>
        <button
          type="button"
          className={`chip ${activeStatus === 'occupied' ? 'chip--active' : ''}`}
          onClick={() => setActiveStatus('occupied')}
        >
          Occupied
        </button>
      </div>

      <div className={activeView === 'map' ? 'floorLayoutWrap' : 'grid'}>
        {activeView === 'map' ? (
          <div className="floorLayout">
            <div
              className="floorPlan"
              role="region"
              aria-label="Floor plan"
              style={{ '--cols': mapCols, '--rows': mapRows }}
            >
              {mapTables.map((t) => {
                const status = normalizedStatus(t.status)
                const hasReservation = reservationByTableId.has(t.id)
                const effectiveStatus = hasReservation ? 'reserved' : status
                return (
                  <div key={t.id} className={`tableTile tableTile--${effectiveStatus}`}>
                    <div className="tableTile__number">{t.number}</div>
                    <div className="tableTile__meta">Seats {t.seats || '?'}</div>
                    <div className={`tableTile__status tableTile__status--${effectiveStatus}`}>{effectiveStatus}</div>
                  </div>
                )
              })}
            </div>

            <div className="floorSelector" role="navigation" aria-label="Floor selector">
              {[1, 2, 3].map((id) => {
                const label = id === 1 ? '1st Floor' : id === 2 ? '2nd Floor' : '3rd Floor'
                const isActive = activeFloor === id
                return (
                  <button
                    key={id}
                    type="button"
                    className={`floorCard ${isActive ? 'floorCard--active' : ''}`}
                    onClick={() => setActiveFloor(id)}
                  >
                    <div className="floorCard__label">{label}</div>
                    <div className="floorCard__thumb" aria-hidden="true">
                      <span className="floorCard__bar" />
                      <span className="floorCard__bar" />
                      <span className="floorCard__bar" />
                      <span className="floorCard__bar" />
                      <span className="floorCard__bar" />
                      <span className="floorCard__bar" />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {activeView === 'byCustomer' ? (
          <div className="tablesSection" style={{ gridColumn: '1 / -1' }}>
            <div className="tablesSection__title">Table by Customer</div>
            {customerKeys.length === 0 ? <div className="muted">No active reservations.</div> : null}
            <div className="stack" style={{ marginTop: 12 }}>
              {customerKeys.map((key) => (
                <div key={key} className="rowCard">
                  <div>
                    <div className="rowCard__title">{key}</div>
                    <div className="muted">Active reservations: {groupedByCustomer[key].length}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {groupedByCustomer[key]
                      .slice()
                      .sort((a, b) => (a.startTimeDate?.getTime?.() || 0) - (b.startTimeDate?.getTime?.() || 0))
                      .map((r) => {
                        const t = tables.find((x) => x.id === r.tableId)
                        const label = t?.number ? `Table ${t.number}` : `TableId ${r.tableId}`
                        return (
                          <span key={r.id} className="badge badge--neutral">
                            {label} • {formatTime(r.startTimeDate)}
                          </span>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeView === 'timeline' ? (
          <div className="tablesSection" style={{ gridColumn: '1 / -1' }}>
            <div className="tablesSection__title">TimeLine</div>
            {filteredReservations.length === 0 ? <div className="muted">No active reservations.</div> : null}
            <div className="stack" style={{ marginTop: 12 }}>
              {filteredReservations
                .slice()
                .sort((a, b) => (a.startTimeDate?.getTime?.() || 0) - (b.startTimeDate?.getTime?.() || 0))
                .map((r) => {
                  const t = tables.find((x) => x.id === r.tableId)
                  const tableLabel = t?.number ? `Table ${t.number}` : `TableId ${r.tableId}`
                  return (
                    <div key={r.id} className="rowCard">
                      <div>
                        <div className="rowCard__title">{formatTime(r.startTimeDate)} • {tableLabel}</div>
                        <div className="muted">Customer: {r.userEmail || r.userId || 'Guest'}</div>
                        <div className="muted">Party: {r.partySize || '—'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className="badge badge--success">active</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
