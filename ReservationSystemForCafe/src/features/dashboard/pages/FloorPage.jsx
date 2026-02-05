import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { formatISODate } from '../../../shared/utils/timeline'
import TableMap from '../../../shared/components/tables/TableMap'
import ReservationPanel from '../../../shared/components/reservations/ReservationPanel'
import { showErrorAlert } from '../../../shared/utils/errorAlert'
import { useTablesQuery } from '../../../modules/tables/application/queries/useTablesQuery'
import { useReservationsQuery } from '../../../modules/reservations/application/queries/useReservationsQuery'

export default function FloorPage() {
  useAuth()
  const navigate = useNavigate()
  const { rows: tables, error: tablesError } = useTablesQuery()
  const { rows: reservations, error: reservationsError } = useReservationsQuery()
  const [activeStatus, setActiveStatus] = useState('all')
  const [activeFloor, setActiveFloor] = useState(1)
  const [selectedTableId, setSelectedTableId] = useState('')
  const [detailsTableId, setDetailsTableId] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [imageViewerSrc, setImageViewerSrc] = useState('')
  const [imageViewerZoom, setImageViewerZoom] = useState(1)
  const [imageThumbErrorByTableId, setImageThumbErrorByTableId] = useState(() => new Map())
  const asideRef = useRef(null)
  const closeDetailsTimerRef = useRef(null)

  useEffect(() => {
    if (tablesError) showErrorAlert(tablesError)
  }, [tablesError])

  useEffect(() => {
    if (reservationsError) showErrorAlert(reservationsError)
  }, [reservationsError])

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
    .map((r) => {
      const status = String(r.status || '').toLowerCase()
      const startTimeDate = toDate(r.startTime)
      const endTimeDate = toDate(r.endTime)
      const holdExpiresAt = toDate(r.holdExpiresAt)
      return { ...r, _status: status, startTimeDate, endTimeDate, _holdExpiresAt: holdExpiresAt }
    })
    .filter((r) => r._status === 'confirmed')

  const filteredTables = tables.filter((t) => {
    const status = normalizedStatus(t.status)
    if (activeStatus === 'all') return true
    return status === activeStatus
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
    if (closeDetailsTimerRef.current) {
      window.clearTimeout(closeDetailsTimerRef.current)
      closeDetailsTimerRef.current = null
    }
    setDetailsOpen(false)
    setSelectedTableId('')
    closeDetailsTimerRef.current = window.setTimeout(() => {
      setDetailsTableId('')
    }, 220)
  }

  function openDetails(tableId) {
    if (closeDetailsTimerRef.current) {
      window.clearTimeout(closeDetailsTimerRef.current)
      closeDetailsTimerRef.current = null
    }
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

  return (
    <div className={'card tablesCard tablesCard--map'}>
      <div className="tablesTop">
        <div className="tablesTop__meta">
          <h2 className="pageTitle">Table map in Café</h2>
        </div>
      </div>

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

      <div className={'floorLayoutWrap'}>
        <div className="floorLayout">
          <TableMap
            tables={mapTables}
            selectedTableId={selectedTableId}
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
                style={{ maxHeight: '95vh', overflowY: 'auto' }}
              >
                <ReservationPanel
                  title="Reservation Details"
                  subtitle="Selected table information"
                  table={selectedTable}
                  floorLabel={selectedTable ? (selectedTable.floor || floorIdForTable(selectedTable)) : ''}
                  statusLabel={selectedTable ? (
                    <span className={`badge badge--neutral`}>
                      {String(normalizedStatus(selectedTable.status)).toUpperCase()}
                    </span>
                  ) : null}
                  placementLabel={selectedTable ? placementLabel(selectedTable.placement) : ''}
                  headerActions={
                    <>
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
                        disabled={!detailsOpen || !panelTableId || !selectedTable || normalizedStatus(selectedTable.status) === 'occupied'}
                        onClick={() =>
                          panelTableId && navigate(`/dashboard/reservations?tableId=${encodeURIComponent(panelTableId)}`)
                        }
                      >
                        Reserve
                      </button>
                    </>
                  }
                  extraCard={(() => {
                    const today = new Date()
                    const now = new Date()
                    const todayIso = formatISODate(today)
                    const sameTable = (r) => r.tableId === panelTableId
                    const isToday = (r) => r.startTimeDate && formatISODate(r.startTimeDate) === todayIso

                    const reservationsToday = activeReservations
                      .filter(sameTable)
                      .filter(isToday)
                      .filter((r) => (r.endTimeDate ? r.endTimeDate >= now : r.startTimeDate >= now))
                      .slice()
                      .sort((a, b) => (a.startTimeDate?.getTime?.() || 0) - (b.startTimeDate?.getTime?.() || 0))

                    const reservationsOtherDays = activeReservations
                      .filter(sameTable)
                      .filter((r) => !isToday(r))
                      .filter((r) => (r.endTimeDate ? r.endTimeDate >= now : r.startTimeDate >= now))
                      .slice()
                      .sort((a, b) => (a.startTimeDate?.getTime?.() || 0) - (b.startTimeDate?.getTime?.() || 0))

                    return (
                      <>
                        <div className="rowCard" style={{ marginTop: 12 }}>
                          <div className="rowCard__title">Reservations today</div>
                          <div style={{ marginTop: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                            {reservationsToday.length === 0 ? (
                              <div className="muted">No reservations for today.</div>
                            ) : reservationsToday.map((r) => (
                              <div key={`today-${r.id}`} className="rowCard" style={{ padding: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div className="rowCard__title">Reserved</div>
                                  <div className="muted">{formatTime(r.startTimeDate)} → {formatTime(r.endTimeDate)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rowCard" style={{ marginTop: 12 }}>
                          <div className="rowCard__title">Other days</div>
                          <div style={{ marginTop: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                            {reservationsOtherDays.length === 0 ? (
                              <div className="muted">No reservations on other days.</div>
                            ) : reservationsOtherDays.map((r) => (
                              <div key={`other-${r.id}`} className="rowCard" style={{ padding: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div className="rowCard__title">Reserved</div>
                                  <div className="muted">{formatISODate(r.startTimeDate)} • {formatTime(r.startTimeDate)} → {formatTime(r.endTimeDate)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )
                  })()}
                  showImage
                  imageUrl={selectedTable?.imageUrl}
                  imageError={selectedTableImageError}
                  onOpenImage={() => selectedTable?.imageUrl && openImageViewer(selectedTable.imageUrl)}
                  onImageError={() =>
                    setImageThumbErrorByTableId((m) => {
                      const next = new Map(m)
                      next.set(panelTableId, true)
                      return next
                    })
                  }
                  onRetryImage={() =>
                    setImageThumbErrorByTableId((m) => {
                      const next = new Map(m)
                      next.delete(panelTableId)
                      return next
                    })
                  }
                />
              </aside>
            ) : null}
        </div>

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

      </div>
    </div>
  )
}
