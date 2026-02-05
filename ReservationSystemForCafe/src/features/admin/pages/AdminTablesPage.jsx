import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { storage } from '../../../shared/firebase'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { formatISODate, TIMELINE_CONFIG } from '../../../shared/utils/timeline'
import TableMap from '../../../shared/components/tables/TableMap'
import TableTimeline from '../../../shared/components/tables/TableTimeline'
import { useTablesQuery } from '../../../modules/tables/application/queries/useTablesQuery'
import { useReservationsQuery } from '../../../modules/reservations/application/queries/useReservationsQuery'
import { useServices } from '../../../app/ServiceContext'

const STATUS_OPTIONS = [
  { value: 'available', label: 'Free (available)' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'occupied', label: 'Occupied' },
]

const SEATS_OPTIONS = [2, 4, 6, 8]
const FLOOR_OPTIONS = [1, 2, 3]

export default function AdminTablesPage() {
  const navigate = useNavigate()
  const { useCases } = useServices()
  const { rows, loading, error: tablesError } = useTablesQuery()
  const { rows: reservations, error: reservationsError } = useReservationsQuery()
  const [error, setError] = useState('')

  const [activeView, setActiveView] = useState('map')
  const [activeFloor, setActiveFloor] = useState(1)
  const [activeStatus, setActiveStatus] = useState('all')
  const [selectedTableId, setSelectedTableId] = useState('')
  const [timelineIsoDate, setTimelineIsoDate] = useState(() => formatISODate(new Date()))
  const [nowOffsetMinutes, setNowOffsetMinutes] = useState(0)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [imageViewerSrc, setImageViewerSrc] = useState('')
  const [imageViewerZoom, setImageViewerZoom] = useState(1)

  const [savingId, setSavingId] = useState('')
  const [deletingId, setDeletingId] = useState('')

  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, tableId: '' })
  const [editDialog, setEditDialog] = useState({ open: false, tableId: '', draft: null })

  // Auto-expire overdue confirmed reservations periodically (every 5 minutes) and on mount
  useEffect(() => {
    let timerId
    async function runExpire() {
      try {
        await useCases.expireOverdueReservations.execute({ reservations })
      } catch {
        /* swallow errors to avoid noisy UI; manual action still available */
        void 0
      }
    }
    runExpire()
    timerId = setInterval(runExpire, 5 * 60 * 1000)
    return () => {
      if (timerId) clearInterval(timerId)
    }
  }, [reservations, useCases.expireOverdueReservations])

  // Calibrate client clock against Firestore server time once on mount
  useEffect(() => {
    let cancelled = false
    async function calibrate() {
      try {
        const bounded = await useCases.pingServerOffsetMinutes.execute()
        if (!cancelled) setNowOffsetMinutes(Number(bounded) || 0)
      } catch {
        // If calibration fails, fall back to device time
        setNowOffsetMinutes(0)
      }
    }
    calibrate()
    return () => { cancelled = true }
  }, [useCases.pingServerOffsetMinutes])

  // Reconcile table statuses on initial data load and whenever tables/reservations change
  useEffect(() => {
    if (!rows || rows.length === 0) return
    // Debounce to avoid rapid consecutive writes
    const timer = setTimeout(() => {
      useCases.reconcileTableStatuses.execute({ tables: rows, reservations }).catch(() => null)
    }, 800)
    return () => clearTimeout(timer)
  }, [rows, reservations, useCases.reconcileTableStatuses])

  useEffect(() => {
    if (!contextMenu.open) return

    const onDocMouseDown = () => setContextMenu({ open: false, x: 0, y: 0, tableId: '' })
    const onDocKeyDown = (e) => {
      if (e.key === 'Escape') setContextMenu({ open: false, x: 0, y: 0, tableId: '' })
    }

    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onDocKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onDocKeyDown)
    }
  }, [contextMenu.open])

  const normalizedStatus = (s) => {
    const v = String(s || '').trim().toLowerCase()
    if (!v) return 'free'
    if (v === 'available') return 'free'
    if (v === 'free') return 'free'
    if (v === 'reserved') return 'reserved'
    if (v === 'occupied') return 'occupied'
    return v
  }

  const statusSymbol = (s) => {
    if (s === 'free') return '✓'
    if (s === 'reserved') return '⌛'
    if (s === 'occupied') return '●'
    return '•'
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
      return d?.toLocaleString?.() || String(d)
    }
  }

  const activeReservations = useMemo(() => {
    const now = new Date()
    return reservations
      .map((r) => {
        const status = String(r.status || '').toLowerCase()
        const startTimeDate = toDate(r.startTime)
        const endTimeDate = toDate(r.endTime)
        const holdExpiresAt = toDate(r.holdExpiresAt)
        return { ...r, _status: status, startTimeDate, endTimeDate, _holdExpiresAt: holdExpiresAt }
      })
      .filter((r) => {
        if (r._status === 'confirmed') return true
        if (r._status === 'occupied') return true
        if (r._status === 'completed') return true
        if (r._status === 'expired') return true
        if (r._status === 'hold') return false
        return false
      })
  }, [reservations])

  const floorIdForTable = (t) => {
    const explicit = Number(t?.floor)
    if (explicit === 1 || explicit === 2 || explicit === 3) return explicit
    return 1
  }

  const filteredTables = useMemo(() => {
    return rows.filter((t) => {
      const status = normalizedStatus(t.status)
      const effectiveStatus = status
      if (activeStatus === 'all') return true
      return effectiveStatus === activeStatus
    })
  }, [activeStatus, rows])

  const mapTables = useMemo(() => {
    return filteredTables
      .filter((t) => floorIdForTable(t) === activeFloor)
      .slice()
      .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))
  }, [activeFloor, filteredTables])

  const timelineTables = useMemo(() => {
    return rows
      .filter((t) => floorIdForTable(t) === activeFloor)
      .filter((t) => {
        const status = normalizedStatus(t.status)
        const effective = status
        if (activeStatus === 'all') return true
        return effective === activeStatus
      })
      .slice()
      .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))
  }, [activeFloor, activeStatus, rows])

  const timelineReservations = useMemo(() => {
    return activeReservations.filter((r) => {
      const t = rows.find((x) => x.id === r.tableId)
      if (!t) return false
      return floorIdForTable(t) === activeFloor
    })
  }, [activeFloor, activeReservations, rows])

  const occupiedTableIdsForFloor = useMemo(() => {
    const set = new Set()
    for (const t of rows) {
      if (floorIdForTable(t) !== activeFloor) continue
      if (normalizedStatus(t.status) === 'occupied') set.add(t.id)
    }
    return set
  }, [activeFloor, rows])

  const selectedRow = useMemo(() => {
    if (!selectedTableId) return null
    return rows.find((r) => r.id === selectedTableId) || null
  }, [rows, selectedTableId])

  const todayIso = useMemo(() => formatISODate(new Date()), [])

  const isAfterClose = useMemo(() => {
    const now = new Date(Date.now() + (Number(nowOffsetMinutes) || 0) * 60 * 1000)
    const mins = now.getHours() * 60 + now.getMinutes()
    return formatISODate(now) === todayIso && mins >= TIMELINE_CONFIG.closeMinutes
  }, [nowOffsetMinutes, todayIso])

  const reservationsForSelectedTableToday = useMemo(() => {
    if (!selectedRow) return []
    const now = new Date()
    const list = reservations
      .filter((r) => r.tableId === selectedRow.id)
      .map((r) => ({
        ...r,
        _status: String(r.status || '').toLowerCase(),
        _start: toDate(r.startTime),
        _end: toDate(r.endTime),
      }))
      .filter((r) =>
        r._status === 'confirmed' &&
        r._start &&
        formatISODate(r._start) === todayIso &&
        !r.checkedInAt &&
        (!r.checkedOutAt) &&
        ((r._end && r._end >= now) || (!r._end && r._start >= now))
      )
      .slice()
      .sort((a, b) => (a._start?.getTime?.() || 0) - (b._start?.getTime?.() || 0))
    return list
  }, [reservations, selectedRow, todayIso])

  const reservationsForSelectedTableOtherDays = useMemo(() => {
    if (!selectedRow) return []
    const now = new Date()
    const list = reservations
      .filter((r) => r.tableId === selectedRow.id)
      .map((r) => ({
        ...r,
        _status: String(r.status || '').toLowerCase(),
        _start: toDate(r.startTime),
        _end: toDate(r.endTime),
      }))
      .filter((r) =>
        r._status === 'confirmed' &&
        r._start &&
        formatISODate(r._start) !== todayIso &&
        !r.checkedInAt &&
        (!r.checkedOutAt) &&
        ((r._end && r._end >= now) || (!r._end && r._start >= now))
      )
      .slice()
      .sort((a, b) => (a._start?.getTime?.() || 0) - (b._start?.getTime?.() || 0))
    return list
  }, [reservations, selectedRow, todayIso])

  const checkedInReservation = useMemo(() => {
    if (!selectedRow) return null
    const list = reservations
      .filter((r) => r.tableId === selectedRow.id)
      .map((r) => ({
        ...r,
        _status: String(r.status || '').toLowerCase(),
        _start: toDate(r.startTime),
        _end: toDate(r.endTime),
      }))
      .filter((r) => r._start && formatISODate(r._start) === todayIso)
    // Ưu tiên xác định bằng checkedInAt/checkedOutAt
    return list.find((r) => r.checkedInAt && !r.checkedOutAt) || null
  }, [reservations, selectedRow, todayIso])

  async function checkInReservation(reservationId) {
    if (!selectedRow || !reservationId) return
    try {
      const r = reservationsForSelectedTableToday.find((x) => x.id === reservationId)
      if (!r) throw new Error('Reservation not found')
      const now = new Date()
      // Allow check-in 10 minutes early
      const tenMinutesBeforeStart = new Date((r._start?.getTime?.() || 0) - 10 * 60 * 1000)
      if (!r._start || now < tenMinutesBeforeStart) {
        throw new Error('Check-in available 10 minutes before start time')
      }
      if (r._end && now > r._end) {
        throw new Error('Đơn đã quá giờ kết thúc')
      }
      await useCases.checkInReservation.execute({ reservation: { id: reservationId, tableId: selectedRow.id } })
    } catch (e) {
      setError(e?.message || 'Failed to check in')
    }
  }

  async function checkOutCurrent() {
    if (!selectedRow) return
    try {
      const now = new Date()
      const hasUpcomingConfirmed = reservationsForSelectedTableToday.some(
        (r) => r._status === 'confirmed' && (!r.checkedInAt || r.checkedOutAt) && r._start && r._start > now
      )
      if (checkedInReservation?.id) {
        await useCases.checkOutReservation.execute({ reservation: { id: checkedInReservation.id, tableId: selectedRow.id }, keepReserved: hasUpcomingConfirmed })
      } else {
        await useCases.manualCheckOut.execute({ tableId: selectedRow.id, keepReserved: hasUpcomingConfirmed })
      }
    } catch (e) {
      setError(e?.message || 'Failed to check out')
    }
  }
  async function manualCheckIn() {
    if (!selectedRow) return
    try {
      if (isAfterClose) {
        setError('Store closed (after 23:00)')
        return
      }
      await useCases.manualCheckIn.execute({ tableId: selectedRow.id })
    } catch (e) {
      setError(e?.message || 'Failed to check in walk-in')
    }
  }

  async function assignFloors() {
    const ok = window.confirm('Auto-assign floor (1/2/3) for all tables based on table number order?')
    if (!ok) return

    setError('')
    try {
      await useCases.assignFloors.execute({ tables: rows })
    } catch (e) {
      setError(e?.message || 'Failed to assign floors')
    }
  }

  function openImageViewer(src) {
    if (!src) return
    setImageViewerSrc(src)
    setImageViewerZoom(1)
    setImageViewerOpen(true)
  }

  function closeImageViewer() {
    setImageViewerOpen(false)
    setImageViewerSrc('')
    setImageViewerZoom(1)
  }

  async function saveEditDialog() {
    setError('')
    const id = editDialog.tableId
    const draft = editDialog.draft
    if (!id || !draft) return

    setSavingId(id)
    try {
      await useCases.saveTableEdit.execute({ tableId: id, draft, existingTables: rows })
      setEditDialog({ open: false, tableId: '', draft: null })
    } catch (e) {
      setError(e?.message || 'Failed to update table')
    } finally {
      setSavingId('')
    }
  }

  async function removeTable(id) {
    const ok = window.confirm('Delete this table?')
    if (!ok) return

    setError('')
    setDeletingId(id)
    try {
      await useCases.deleteTable.execute({ tableId: id })
    } catch (e) {
      setError(e?.message || 'Failed to delete table')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div>
            <h2 className="pageTitle">Admin • Tables</h2>
            {/* <div className="muted">Create, update, and delete tables</div> */}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn--primary" type="button" onClick={() => navigate('/admin/dashboard/tables/new')}>
              Add table
            </button>
            <button className="btn" disabled={loading || rows.length === 0} onClick={assignFloors}>
              Auto-assign floors
            </button>
          </div>
        </div>

        {error || tablesError ? <div className="error" style={{ marginTop: 12 }}>{error || tablesError}</div> : null}
        {reservationsError ? <div className="error" style={{ marginTop: 12 }}>{reservationsError}</div> : null}
      </div>

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
              className={`tabBtn ${activeView === 'timeline' ? 'tabBtn--active' : ''}`}
              onClick={() => setActiveView('timeline')}
            >
              TimeLine
            </button>
          </div>

          <div className="tablesTop__meta">
            <div style={{ fontWeight: 800 }}>Total: {rows.length}</div>
            {loading ? <div className="muted">Loading…</div> : null}
            {/* <button className="btn" style={{ marginLeft: 10 }} onClick={expireOverdueConfirmed}>
              Expire overdue (30m)
            </button> */}
          </div>
        </div>

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
                normalizedStatus={normalizedStatus}
                statusSymbol={statusSymbol}
                onBackgroundClick={() => setSelectedTableId('')}
                onTableClick={(t) => setSelectedTableId(t.id)}
                onTableContextMenu={(t, e) => {
                  setSelectedTableId(t.id)
                  setContextMenu({ open: true, x: e.clientX, y: e.clientY, tableId: t.id })
                }}
              />

              {selectedRow ? (
                <aside className="tablesAside tablesAside--open" aria-label="Table details" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                  <section className="reservationPanel" aria-label="Selected table">
                    <header className="reservationPanel__header">
                      <div>
                        <div className="reservationPanel__title">Table</div>
                        {/* <div className="reservationPanel__subtitle">Right-click for Edit/Delete</div> */}
                      </div>
                      <div className="reservationPanel__actions">
                        <button type="button" className="detailsCollapseBtn" onClick={() => setSelectedTableId('')}>
                          →
                        </button>
                        {String(selectedRow.status || '') === 'occupied' ? (
                          <button type="button" className="btn" onClick={checkOutCurrent}>
                            Check out
                          </button>
                        ) : reservationsForSelectedTableToday.length > 0 ? (
                          <span className="badge badge--neutral">Has reservation today</span>
                        ) : (
                          <button type="button" className="btn" onClick={manualCheckIn} disabled={isAfterClose} title={isAfterClose ? 'Store closed after 23:00' : undefined}>
                            Check in (Walk-in)
                          </button>
                        )}
                      </div>

                      <div style={{ marginTop: 12, flex: '0 0 100%', width: '100%' }}>
                        {selectedRow?.imageUrl ? (
                          <button
                            type="button"
                            className="reservationPanel__thumbBtn"
                            onClick={() => openImageViewer(selectedRow.imageUrl)}
                            aria-label="View table image"
                          >
                            <img className="reservationPanel__thumb" src={selectedRow.imageUrl} alt="Table photo" loading="lazy" referrerPolicy="no-referrer" />
                          </button>
                        ) : (
                          <div className="muted">No image.</div>
                        )}
                      </div>
                    </header>
                    <div className="reservationPanel__body">
                      <div className="kv">
                        <div className="kv__row">
                          <div className="kv__k">Number</div>
                          <div className="kv__v">{selectedRow.number ?? '—'}</div>
                        </div>
                        <div className="kv__row">
                          <div className="kv__k">Seats</div>
                          <div className="kv__v">{selectedRow.seats ?? '—'}</div>
                        </div>
                        <div className="kv__row">
                          <div className="kv__k">Floor</div>
                          <div className="kv__v">{selectedRow.floor ?? '—'}</div>
                        </div>
                        {/* <div className="kv__row">
                          <div className="kv__k">Status</div>
                          <div className="kv__v">{normalizedStatus(selectedRow.status)}</div>
                        </div> */}
                        {checkedInReservation ? (
                          <>
                            <div className="kv__row">
                              <div className="kv__k">Currently dining</div>
                              <div className="kv__v">{checkedInReservation.customerName || checkedInReservation.userEmail || '—'}</div>
                            </div>
                            <div className="kv__row">
                              <div className="kv__k">Time</div>
                              <div className="kv__v">{formatTime(checkedInReservation._start)} → {formatTime(checkedInReservation._end)}</div>
                            </div>
                          </>
                        ) : (
                          String(selectedRow.status || '') === 'occupied' ? (
                            <div className="kv__row"><div className="kv__k">Currently dining</div><div className="kv__v">Walk-in</div></div>
                          ) : (
                            <div className="kv__row"><div className="kv__k">Currently dining</div><div className="kv__v">—</div></div>
                          )
                        )}
                      </div>

                      <div className="rowCard" style={{ marginTop: 12 }}>
                        <div className="rowCard__title">Reservations today</div>
                        <div style={{ marginTop: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                          {reservationsForSelectedTableToday.length === 0 ? (
                            <div className="muted">No reservations for today.</div>
                          ) : reservationsForSelectedTableToday.map((r) => {
                            const now = new Date()
                            const canCheckIn =
                              r._status === 'confirmed' &&
                              !r.checkedInAt &&
                              String(selectedRow.status || '') !== 'occupied' &&
                              r._start && now >= r._start && (!r._end || now <= r._end)
                            return (
                              <div key={r.id} className="rowCard" style={{ padding: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div className="rowCard__title">{r.customerName || r.userEmail || '—'}</div>
                                  <div className="muted">{formatTime(r._start)} → {formatTime(r._end)}</div>
                                </div>
                                <div>
                                  {canCheckIn ? (
                                    <button className="btn" onClick={() => checkInReservation(r.id)}>Check in</button>
                                  ) : (
                                    <span className="badge badge--neutral">—</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="rowCard" style={{ marginTop: 12 }}>
                        <div className="rowCard__title">Other days</div>
                        <div style={{ marginTop: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                          {reservationsForSelectedTableOtherDays.length === 0 ? (
                            <div className="muted">No reservations on other days.</div>
                          ) : (
                            reservationsForSelectedTableOtherDays.map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                className="rowCard"
                                style={{ padding: 8, textAlign: 'left', cursor: 'pointer' }}
                                onClick={() => navigate(`/admin/dashboard/reservations/${r.id}`)}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div className="rowCard__title">{r.customerName || r.userEmail || '—'}</div>
                                  <div className="muted">{formatISODate(r._start)} • {formatTime(r._start)} → {formatTime(r._end)}</div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                </aside>
              ) : null}
            </div>
          ) : null}

          {activeView === 'timeline' ? (
            <TableTimeline
              tables={timelineTables}
              reservations={timelineReservations}
              isoDate={timelineIsoDate}
              onChangeIsoDate={(next) => setTimelineIsoDate(next)}
              onOpenReservation={(id) => navigate(`/admin/dashboard/reservations/${id}`)}
              occupiedTableIds={occupiedTableIdsForFloor}
              nowOffsetMinutes={nowOffsetMinutes}
            />
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
        </div>
      </div>

      {contextMenu.open ? (
        <div
          className="contextMenu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
          aria-label="Table actions"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="btn contextMenu__btn"
            onClick={() => {
              const r = rows.find((x) => x.id === contextMenu.tableId)
              if (!r) return
              setContextMenu({ open: false, x: 0, y: 0, tableId: '' })
              setEditDialog({
                open: true,
                tableId: r.id,
                draft: {
                  number: r.number ?? '',
                  seats: r.seats ?? '',
                  floor: r.floor ?? 1,
                  status: r.status || 'available',
                  imageUrl: r.imageUrl || '',
                },
              })
            }}
          >
            Edit Table
          </button>
          <button
            type="button"
            className="btn contextMenu__btn"
            disabled={deletingId === contextMenu.tableId}
            onClick={() => {
              const id = contextMenu.tableId
              setContextMenu({ open: false, x: 0, y: 0, tableId: '' })
              removeTable(id)
            }}
          >
            {deletingId === contextMenu.tableId ? 'Deleting…' : 'Delete Table'}
          </button>
        </div>
      ) : null}

      {editDialog.open && editDialog.draft ? (
        <div
          className="imageModal"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditDialog({ open: false, tableId: '', draft: null })
          }}
        >
          <div className="imageModal__dialog imageModal__dialog--form" style={{ maxWidth: 640 }}>
            <button
              type="button"
              className="imageModal__close"
              aria-label="Close"
              onClick={() => setEditDialog({ open: false, tableId: '', draft: null })}
            >
              ×
            </button>

            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Edit Table</div>

            <div className="formGrid">
              <label className="field">
                <div className="field__label">Number</div>
                <input
                  className="input"
                  value={editDialog.draft.number}
                  onChange={(e) =>
                    setEditDialog((prev) => ({
                      ...prev,
                      draft: { ...prev.draft, number: e.target.value },
                    }))
                  }
                />
              </label>

              <label className="field">
                <div className="field__label">Seats</div>
                <select
                  className="input"
                  value={String(editDialog.draft.seats)}
                  onChange={(e) =>
                    setEditDialog((prev) => ({
                      ...prev,
                      draft: { ...prev.draft, seats: e.target.value },
                    }))
                  }
                >
                  {SEATS_OPTIONS.map((s) => (
                    <option key={s} value={String(s)}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <div className="field__label">Floor</div>
                <select
                  className="input"
                  value={String(editDialog.draft.floor)}
                  onChange={(e) =>
                    setEditDialog((prev) => ({
                      ...prev,
                      draft: { ...prev.draft, floor: e.target.value },
                    }))
                  }
                >
                  {FLOOR_OPTIONS.map((f) => (
                    <option key={f} value={String(f)}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field">
                <div className="field__label">Status</div>
                <div>
                  <span className="badge badge--neutral">{String(editDialog.draft.status || '')}</span>
                </div>
              </div>

              <div className="field">
                <div className="field__label">Photo</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {editDialog.draft.imageUrl ? (
                    <img src={editDialog.draft.imageUrl} alt="Table image" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(17,24,39,0.12)' }} />
                  ) : (
                    <div className="muted">No image</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input type="file" accept="image/*" onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        const path = `tables/${editDialog.tableId}/${Date.now()}-${file.name}`
                        const sref = storageRef(storage, path)
                        await uploadBytes(sref, file)
                        const url = await getDownloadURL(sref)
                        setEditDialog((prev) => ({ ...prev, draft: { ...prev.draft, imageUrl: url } }))
                      } catch (err) {
                        setError(err?.message || 'Failed to upload image')
                      } finally {
                        e.target.value = ''
                      }
                    }} />
                    {editDialog.draft.imageUrl ? (
                      <button type="button" className="btn" onClick={() => setEditDialog((prev) => ({ ...prev, draft: { ...prev.draft, imageUrl: '' } }))}>
                        Remove image
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setEditDialog({ open: false, tableId: '', draft: null })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={savingId === editDialog.tableId}
                onClick={saveEditDialog}
              >
                {savingId === editDialog.tableId ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
