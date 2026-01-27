import { useEffect, useRef, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../shared/firebase'
import { useAuth } from '../../auth/useAuth'
import { formatISODate } from '../../../shared/utils/timeline'
import TableMap from '../../../shared/components/tables/TableMap'
import TableTimeline from '../../../shared/components/tables/TableTimeline'

export default function FloorPage() {
  useAuth()
  const navigate = useNavigate()
  const [tables, setTables] = useState([])
  const [activeView, setActiveView] = useState('map')
  const [activeStatus, setActiveStatus] = useState('all')
  const [activeFloor, setActiveFloor] = useState(1)
  const [timelineIsoDate, setTimelineIsoDate] = useState(() => formatISODate(new Date()))
  const [selectedTableId, setSelectedTableId] = useState('')
  const [detailsTableId, setDetailsTableId] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [imageViewerSrc, setImageViewerSrc] = useState('')
  const [imageViewerZoom, setImageViewerZoom] = useState(1)
  const [imageThumbErrorByTableId, setImageThumbErrorByTableId] = useState(() => new Map())
  const [error, setError] = useState('')
  const [reservations, setReservations] = useState([])
  const [reservationsError, setReservationsError] = useState('')
  const asideRef = useRef(null)

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

  const formatDate = (d) => {
    if (!d) return '—'
    try {
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
    } catch {
      return d.toISOString?.().slice(0, 10) || String(d)
    }
  }

  const now = new Date()
  const activeReservations = reservations
    .map((r) => {
      const status = String(r.status || '').toLowerCase()
      const startTimeDate = toDate(r.startTime)
      const endTimeDate = toDate(r.endTime)
      const holdExpiresAt = toDate(r.holdExpiresAt)
      return { ...r, _status: status, startTimeDate, endTimeDate, _holdExpiresAt: holdExpiresAt }
    })
    .filter((r) => {
      // Only confirmed reservations mark tables as reserved for customers
      return r._status === 'confirmed'
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

  function closeDetails() {
    setDetailsOpen(false)
    setSelectedTableId('')
    window.setTimeout(() => {
      setDetailsTableId('')
    }, 220)
  }

  function openDetails(tableId) {
    setDetailsTableId(tableId)
    setSelectedTableId(tableId)
    setDetailsOpen(true)
  }

  // Close reservation panel when clicking anywhere outside it
  useEffect(() => {
    if (!detailsOpen) return
    const onDocMouseDown = (e) => {
      const el = asideRef.current
      if (!el) return
      if (el.contains(e.target)) return
      // Clicked outside the panel; close it
      closeDetails()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [detailsOpen])

  const panelTableId = detailsTableId
  const selectedTable = panelTableId ? tables.find((t) => t.id === panelTableId) || null : null
  const selectedReservation = panelTableId ? reservationByTableId.get(panelTableId) || null : null

  const selectedTableImageError = panelTableId ? imageThumbErrorByTableId.get(panelTableId) || false : false

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
    if (key === 'window_seat' || key === 'photo_spot') return 'Photo Spot'
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

  const timelineTables = tables
    .filter((t) => floorIdForTable(t) === activeFloor)
    .slice()
    .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))

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
            <TableMap
              tables={mapTables}
              selectedTableId={selectedTableId}
              reservationByTableId={reservationByTableId}
              normalizedStatus={normalizedStatus}
              statusSymbol={statusSymbol}
              onBackgroundClick={() => closeDetails()}
              onTableClick={(t) => {
                if (selectedTableId === t.id) {
                  closeDetails()
                  return
                }
                openDetails(t.id)
              }}
            />

            {panelTableId ? (
              <aside
                ref={asideRef}
                className={`tablesAside ${detailsOpen ? 'tablesAside--open' : 'tablesAside--closed'}`}
                aria-label="Table details"
              >
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
                        onClick={closeDetails}
                      >
                        →
                      </button>
                      <button
                        type="button"
                        className="brandButton"
                        disabled={!detailsOpen || !panelTableId || !selectedTable || (selectedReservation || normalizedStatus(selectedTable.status) !== 'free')}
                        onClick={() =>
                          panelTableId && navigate(`/dashboard/reservations?tableId=${encodeURIComponent(panelTableId)}`)
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
                        selectedTableImageError ? (
                          <div className="rowCard" style={{ marginTop: 12, padding: 12 }}>
                            <div>
                              <div className="rowCard__title">Image failed to load</div>
                              <div className="muted" style={{ marginTop: 4 }}>The image URL may be invalid, private, expired, or blocked by the host.</div>
                              <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <a className="btn" href={selectedTable.imageUrl} target="_blank" rel="noreferrer">Open image</a>
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => setImageThumbErrorByTableId((m) => {
                                    const next = new Map(m)
                                    next.delete(panelTableId)
                                    return next
                                  })}
                                >
                                  Retry
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="reservationPanel__thumbBtn"
                            onClick={() => openImageViewer(selectedTable.imageUrl)}
                            aria-label="View table image"
                          >
                            <img
                              className="reservationPanel__thumb"
                              src={selectedTable.imageUrl}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setImageThumbErrorByTableId((m) => {
                                  const next = new Map(m)
                                  next.set(panelTableId, true)
                                  return next
                                })
                              }
                            />
                          </button>
                        )
                      ) : (
                        <div className="muted" style={{ marginTop: 12 }}>
                          No image.
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

        {/* Customer view: timeline hidden to avoid exposing active reservations */}
      </div>
    </div>
  )
}
