import { useEffect, useState } from 'react'
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../../../shared/firebase'
import { useAuth } from '../../auth/AuthContext.jsx'

export default function FloorPage() {
  useAuth()
  const [tables, setTables] = useState([])
  const [activeView, setActiveView] = useState('map')
  const [activeStatus, setActiveStatus] = useState('all')
  const [error, setError] = useState('')
  const [reservations, setReservations] = useState([])
  const [reservationsError, setReservationsError] = useState('')
  const [seeding, setSeeding] = useState(false)

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

  const activeReservations = reservations
    .filter((r) => String(r.status || '').toLowerCase() === 'active')
    .map((r) => ({
      ...r,
      startTimeDate: toDate(r.startTime),
    }))

  const reservationByTableId = new Map()
  for (const r of activeReservations) {
    if (!r.tableId) continue
    if (!reservationByTableId.has(r.tableId)) reservationByTableId.set(r.tableId, r)
  }

  const filteredTables = tables.filter((t) => {
    if (activeStatus === 'all') return true
    return normalizedStatus(t.status) === activeStatus
  })

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

  async function seedDemoTables() {
    const ok = window.confirm('Create demo tables in Firestore? This may overwrite existing demo table docs (T01..T20).')
    if (!ok) return

    setError('')
    setSeeding(true)
    try {
      const batch = writeBatch(db)
      const demo = Array.from({ length: 20 }, (_, i) => {
        const number = i + 1
        const seats = number <= 6 ? 2 : number <= 14 ? 4 : 6
        const status = number % 9 === 0 ? 'occupied' : number % 4 === 0 ? 'reserved' : 'available'
        return { id: `T${String(number).padStart(2, '0')}`, number, seats, status }
      })

      for (const t of demo) {
        batch.set(doc(db, 'tables', t.id), {
          number: t.number,
          seats: t.seats,
          status: t.status,
          updatedAt: serverTimestamp(),
        })
      }

      await batch.commit()
    } catch (e) {
      setError(e?.message || 'Failed to seed demo tables')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="card">
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

      <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" disabled={seeding} onClick={seedDemoTables}>
          {seeding ? 'Seeding…' : 'Seed demo tables'}
        </button>
      </div>

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

      <div className="grid">
        {activeView === 'map'
          ? filteredTables.map((t) => {
              const status = normalizedStatus(t.status)
              const r = reservationByTableId.get(t.id)
              return (
                <div key={t.id} className={`tableCard tableCard--${status}`}>
                  <div className="tableCard__top">
                    <div className="tableCard__title">Table {t.number}</div>
                    <div className={`statusPill statusPill--${status}`}>{status}</div>
                  </div>
                  <div className="tableCard__meta">Seats: {t.seats || '?'}</div>
                  {r ? (
                    <div className="tableCard__reservation">
                      <div className="muted">Reserved for: {r.userEmail || r.userId || 'Guest'}</div>
                      <div className="muted">
                        {formatTime(r.startTimeDate)} • Party: {r.partySize || '—'}
                      </div>
                    </div>
                  ) : (
                    <div className="tableCard__reservation">
                      <div className="muted">No active reservation</div>
                    </div>
                  )}
                </div>
              )
            })
          : null}

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
