import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../shared/firebase'
import { useAuth } from '../../auth/useAuth'

export default function FloorPage() {
  useAuth()
  const navigate = useNavigate()
  const [tables, setTables] = useState([])
  const [activeView, setActiveView] = useState('map')
  const [activeStatus, setActiveStatus] = useState('all')
  const [activeFloor, setActiveFloor] = useState(1)
  const [selectedTableId, setSelectedTableId] = useState('')
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [imageViewerSrc, setImageViewerSrc] = useState('')
  const [imageViewerZoom, setImageViewerZoom] = useState(1)
  const [error, setError] = useState('')
  const [reservations, setReservations] = useState([])
  const [reservationsError, setReservationsError] = useState('')

  useEffect(() => {
    const qTables = query(collection(db, 'tables'), orderBy('number', 'asc'))
    const unsub = onSnapshot(
      qTables,
      (snap) => {
        setError('')
        setTables(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      },
      (e) => setError(e?.message || 'Failed to load tables')
    )

    return () => unsub()
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'), limit(100))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setReservationsError('')
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

  const selectedTableIdForView = (() => {
    if (!selectedTableId) return ''
    return mapTables.some((t) => t.id === selectedTableId) ? selectedTableId : ''
  })()

  const selectedTable = selectedTableIdForView ? mapTables.find((t) => t.id === selectedTableIdForView) || null : null
  const selectedReservation = selectedTableIdForView ? reservationByTableId.get(selectedTableIdForView) || null : null

  const statusSymbol = (s) => {
    if (s === 'free') return '✓'
    if (s === 'reserved') return '⌛'
    if (s === 'occupied') return '●'
    return '•'
  }

  const placementLabel = (v) => {
    const key = String(v || '').trim()
    if (!key) return '—'
    if (key === 'quiet_zone') return 'Quiet Zone'
    if (key === 'window_seat') return 'Window Seat'
    if (key === 'near_power_outlets') return 'Near power outlets'
    return key
  }

  const openImageViewer = (src) => {
    if (!src) return
    setImageViewerSrc(src)
    setImageViewerZoom(1)
    setImageViewerOpen(true)
  }

  const closeImageViewer = () => {
    setImageViewerOpen(false)
    setImageViewerSrc('')
    setImageViewerZoom(1)
  }

  const filteredReservations = activeReservations.filter(() => {
    if (activeStatus === 'all') return true
    if (activeStatus === 'reserved') return true
    return false
  })

  const timelineReservations = filteredReservations.filter((r) => {
    const t = tables.find((x) => x.id === r.tableId)
    if (!t) return false
    return floorIdForTable(t) === activeFloor
  })

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

      {(activeView === 'map' || activeView === 'timeline') ? (
        <div className="floorSelectorRow" role="navigation" aria-label="Floor selector">
          {[1, 2, 3].map((id) => {
            const label = id === 1 ? '1st Floor' : id === 2 ? '2nd Floor' : '3rd Floor'
            const isActive = activeFloor === id
            return (
              <button
                key={id}
                type="button"
                className={`tabBtn ${isActive ? 'tabBtn--active' : ''}`}
                onClick={() => {
                  setSelectedTableId('')
                  setActiveFloor(id)
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      ) : null}

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
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedTableId('')
              }}
            >
              {mapTables.map((t) => {
                const status = normalizedStatus(t.status)
                const hasReservation = reservationByTableId.has(t.id)
                const effectiveStatus = hasReservation ? 'reserved' : status
                const isActive = t.id === selectedTableId
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`tableItem ${isActive ? 'tableItem--active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedTableId(t.id)
                    }}
                  >
                    <div className={`tableSquare tableSquare--${effectiveStatus}`}>
                      <div className={`tableSquare__icon tableSquare__icon--${effectiveStatus}`}>
                        <span className="tableSquare__symbol">{statusSymbol(effectiveStatus)}</span>
                      </div>
                      <div className={`tableSquare__status tableSquare__status--${effectiveStatus}`}>{effectiveStatus}</div>
                    </div>
                    <div className="tableNumber">{t.number}</div>
                  </button>
                )
              })}
            </div>

            {selectedTableId ? (
              <aside className="tablesAside" aria-label="Table details">
                <section className="reservationPanel" aria-label="Reservation Details">
                  <header className="reservationPanel__header">
                    <div>
                      <div className="reservationPanel__title">Reservation Details</div>
                      <div className="reservationPanel__subtitle">Selected table information</div>
                    </div>

                    <div className="reservationPanel__actions">
                      <button
                        type="button"
                        className="detailsCollapseBtn"
                        aria-label="Collapse Reservation Details"
                        onClick={() => setSelectedTableId('')}
                      >
                        →
                      </button>
                      <button
                        type="button"
                        className="brandButton"
                        disabled={!selectedTableId}
                        onClick={() =>
                          selectedTableId && navigate(`/dashboard/reservations?tableId=${encodeURIComponent(selectedTableId)}`)
                        }
                      >
                        Reserve
                      </button>
                    </div>
                  </header>

                  {!selectedTable ? (
                    <div className="reservationPanel__empty">Select a table to view details.</div>
                  ) : (
                    <div className="reservationPanel__body">
                      <div className="kv">
                        <div className="kv__row">
                          <div className="kv__k">Table</div>
                          <div className="kv__v">{selectedTable.number}</div>
                        </div>
                        <div className="kv__row">
                          <div className="kv__k">Floor</div>
                          <div className="kv__v">{selectedTable.floor || floorIdForTable(selectedTable)}</div>
                        </div>
                        <div className="kv__row">
                          <div className="kv__k">Seats</div>
                          <div className="kv__v">{selectedTable.seats || '—'}</div>
                        </div>
                        <div className="kv__row">
                          <div className="kv__k">Status</div>
                          <div className="kv__v">
                            <span className={`badge badge--neutral`}>{String(selectedReservation ? 'reserved' : normalizedStatus(selectedTable.status)).toUpperCase()}</span>
                          </div>
                        </div>
                        <div className="kv__row">
                          <div className="kv__k">Placement</div>
                          <div className="kv__v">{placementLabel(selectedTable.placement)}</div>
                        </div>
                      </div>

                      {selectedTable.imageUrl ? (
                        <button
                          type="button"
                          className="reservationPanel__thumbBtn"
                          onClick={() => openImageViewer(selectedTable.imageUrl)}
                          aria-label="View table image"
                        >
                          <img className="reservationPanel__thumb" src={selectedTable.imageUrl} alt="" loading="lazy" />
                        </button>
                      ) : (
                        <div className="muted" style={{ marginTop: 12 }}>
                          No image.
                        </div>
                      )}

                      {selectedReservation ? (
                        <div className="rowCard" style={{ marginTop: 12 }}>
                          <div>
                            <div className="rowCard__title">Active reservation</div>
                            <div className="muted">Customer: {selectedReservation.userEmail || selectedReservation.userId || 'Guest'}</div>
                            <div className="muted">Party: {selectedReservation.partySize || '—'}</div>
                            <div className="muted">Start: {formatTime(selectedReservation.startTimeDate)}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span className="badge badge--success">active</span>
                          </div>
                        </div>
                      ) : (
                        <div className="muted" style={{ marginTop: 12 }}>
                          No active reservations for this table.
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </aside>
            ) : null}
          </div>
        ) : null}

        {imageViewerOpen && imageViewerSrc ? (
          <div
            className="imageModal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeImageViewer()
            }}
          >
            <div className="imageModal__dialog">
              <button type="button" className="imageModal__close" aria-label="Close" onClick={closeImageViewer}>
                ×
              </button>

              <div className="imageModal__controls" aria-label="Image zoom controls">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setImageViewerZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                >
                  -
                </button>
                <div className="muted" style={{ minWidth: 56, textAlign: 'center' }}>{Math.round(imageViewerZoom * 100)}%</div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setImageViewerZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
                >
                  +
                </button>
              </div>

              <div className="imageModal__imgWrap">
                <img
                  className="imageModal__img"
                  src={imageViewerSrc}
                  alt=""
                  style={{ transform: `scale(${imageViewerZoom})` }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {activeView === 'timeline' ? (
          <div className="tablesSection" style={{ gridColumn: '1 / -1' }}>
            <div className="tablesSection__title">TimeLine</div>
            {timelineReservations.length === 0 ? <div className="muted">No active reservations.</div> : null}
            <div className="stack" style={{ marginTop: 12 }}>
              {timelineReservations
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
