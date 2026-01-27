import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  limit,
} from 'firebase/firestore'
import { db } from '../../../shared/firebase'
import { formatISODate } from '../../../shared/utils/timeline'
import TableMap from '../../../shared/components/tables/TableMap'
import TableTimeline from '../../../shared/components/tables/TableTimeline'

const STATUS_OPTIONS = [
  { value: 'available', label: 'Free (available)' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'occupied', label: 'Occupied' },
]

const SEATS_OPTIONS = [2, 4, 6, 8]
const FLOOR_OPTIONS = [1, 2, 3]

function toInt(value, fallback) {
  const n = Number.parseInt(String(value), 10)
  return Number.isFinite(n) ? n : fallback
}

export default function AdminTablesPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [activeView, setActiveView] = useState('map')
  const [activeFloor, setActiveFloor] = useState(1)
  const [activeStatus, setActiveStatus] = useState('all')
  const [selectedTableId, setSelectedTableId] = useState('')
  const [timelineIsoDate, setTimelineIsoDate] = useState(() => formatISODate(new Date()))

  const [savingId, setSavingId] = useState('')
  const [deletingId, setDeletingId] = useState('')

  const [reservations, setReservations] = useState([])
  const [reservationsError, setReservationsError] = useState('')

  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, tableId: '' })
  const [editDialog, setEditDialog] = useState({ open: false, tableId: '', draft: null })

  useEffect(() => {
    setError('')
    setLoading(true)

    const q = query(collection(db, 'tables'), orderBy('number', 'asc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (e) => {
        setError(e?.message || 'Failed to load tables')
        setLoading(false)
      }
    )

    return () => unsub()
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'), limit(200))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setReservationsError('')
        setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      },
      (e) => setReservationsError(e?.message || 'Failed to load reservations')
    )
    return () => unsub()
  }, [])

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
        if (r._status === 'hold') return r._holdExpiresAt && r._holdExpiresAt > now
        return false
      })
  }, [reservations])

  const activeConfirmedReservations = useMemo(() => {
    return activeReservations.filter((r) => r._status === 'confirmed')
  }, [activeReservations])

  const reservationByTableId = useMemo(() => {
    const map = new Map()
    const now = new Date()
    for (const r of activeConfirmedReservations) {
      if (!r.tableId) continue
      const s = r.startTimeDate
      const e = r.endTimeDate
      if (!(s instanceof Date) || !(e instanceof Date)) continue
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue
      // Consider table reserved on the map only during the actual reservation time window
      if (s <= now && e > now) {
        if (!map.has(r.tableId)) map.set(r.tableId, r)
      }
    }
    return map
  }, [activeConfirmedReservations])

  const floorIdForTable = (t) => {
    const explicit = Number(t?.floor)
    if (explicit === 1 || explicit === 2 || explicit === 3) return explicit
    return 1
  }

  const filteredTables = useMemo(() => {
    return rows.filter((t) => {
      const status = normalizedStatus(t.status)
      const hasReservation = reservationByTableId.has(t.id)
      const effectiveStatus = hasReservation ? 'reserved' : status
      if (activeStatus === 'all') return true
      return effectiveStatus === activeStatus
    })
  }, [activeStatus, reservationByTableId, rows])

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
        const hasRes = reservationByTableId.has(t.id)
        const status = normalizedStatus(t.status)
        const effective = hasRes ? 'reserved' : status
        if (activeStatus === 'all') return true
        return effective === activeStatus
      })
      .slice()
      .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))
  }, [activeFloor, activeStatus, reservationByTableId, rows])

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

  const reservationsForSelectedTableToday = useMemo(() => {
    if (!selectedRow) return []
    const list = reservations
      .filter((r) => r.tableId === selectedRow.id)
      .map((r) => ({
        ...r,
        _status: String(r.status || '').toLowerCase(),
        _start: toDate(r.startTime),
        _end: toDate(r.endTime),
      }))
      .filter((r) => r._status === 'confirmed' && r._start && formatISODate(r._start) === todayIso)
      .slice()
      .sort((a, b) => (a._start?.getTime?.() || 0) - (b._start?.getTime?.() || 0))
    return list
  }, [reservations, selectedRow, todayIso])

  const checkedInReservation = useMemo(() => {
    return reservationsForSelectedTableToday.find((r) => r.checkedInAt && !r.checkedOutAt) || null
  }, [reservationsForSelectedTableToday])

  async function checkInReservation(reservationId) {
    if (!selectedRow || !reservationId) return
    try {
      const r = reservationsForSelectedTableToday.find((x) => x.id === reservationId)
      if (!r) throw new Error('Reservation not found')
      const now = new Date()
      if (!r._start || now < r._start) {
        throw new Error('Chỉ cho phép check-in từ thời gian bắt đầu')
      }
      if (r._end && now > r._end) {
        throw new Error('Đơn đã quá giờ kết thúc')
      }

      await updateDoc(doc(db, 'reservations', reservationId), {
        checkedInAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await updateDoc(doc(db, 'tables', selectedRow.id), {
        status: 'occupied',
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      setError(e?.message || 'Failed to check in')
    }
  }

  async function checkOutCurrent() {
    if (!selectedRow) return
    try {
      if (checkedInReservation) {
        await updateDoc(doc(db, 'reservations', checkedInReservation.id), {
          checkedOutAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      // If there are other upcoming confirmed reservations today, keep table reserved
      const now = new Date()
      const hasUpcomingConfirmed = reservationsForSelectedTableToday.some(
        (r) => r._status === 'confirmed' && (!r.checkedInAt || r.checkedOutAt) && r._start && r._start > now
      )
      await updateDoc(doc(db, 'tables', selectedRow.id), {
        status: hasUpcomingConfirmed ? 'reserved' : 'available',
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      setError(e?.message || 'Failed to check out')
    }
  }

  async function expireOverdueConfirmed() {
    // Expire confirmed reservations that are 30 minutes past startTime and not checked in
    try {
      const now = new Date()
      const cutoff = now.getTime() - 30 * 60 * 1000
      const toExpire = reservations.filter((r) => {
        const s = String(r.status || '').toLowerCase()
        if (s !== 'confirmed') return false
        if (r.checkedInAt) return false
        const start = toDate(r.startTime)
        if (!(start instanceof Date)) return false
        return start.getTime() < cutoff
      })
      if (toExpire.length === 0) return
      const batch = writeBatch(db)
      for (const r of toExpire) {
        batch.update(doc(db, 'reservations', r.id), {
          status: 'expired',
          expiredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      await batch.commit()
    } catch (e) {
      setError(e?.message || 'Failed to expire overdue reservations')
    }
  }

  async function assignFloors() {
    const ok = window.confirm('Auto-assign floor (1/2/3) for all tables based on table number order?')
    if (!ok) return

    setError('')
    try {
      const sorted = rows
        .slice()
        .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))

      const perFloor = Math.max(1, Math.ceil(sorted.length / 3))
      const batch = writeBatch(db)

      for (let i = 0; i < sorted.length; i += 1) {
        const r = sorted[i]
        const floor = Math.min(3, Math.max(1, Math.floor(i / perFloor) + 1))
        batch.update(doc(db, 'tables', r.id), {
          floor,
          updatedAt: serverTimestamp(),
        })
      }

      await batch.commit()
    } catch (e) {
      setError(e?.message || 'Failed to assign floors')
    }
  }

  async function saveEditDialog() {
    setError('')
    const id = editDialog.tableId
    const draft = editDialog.draft
    if (!id || !draft) return

    const number = toInt(draft.number, NaN)
    const seats = toInt(draft.seats, NaN)
    const floor = toInt(draft.floor, NaN)

    if (!Number.isFinite(number) || number <= 0) {
      setError('Table number must be a positive integer')
      return
    }
    if (!Number.isFinite(seats) || seats <= 0) {
      setError('Seats must be a positive integer')
      return
    }

    if (!SEATS_OPTIONS.includes(seats)) {
      setError('Seats must be one of: 2, 4, 6, 8')
      return
    }

    const exists = rows.some((r) => r.id !== id && Number(r.number) === number)
    if (exists) {
      setError('Another table already has this number')
      return
    }

    setSavingId(id)
    try {
      await updateDoc(doc(db, 'tables', id), {
        number,
        seats,
        floor,
        status: draft.status,
        updatedAt: serverTimestamp(),
      })
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
      await deleteDoc(doc(db, 'tables', id))
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
            <div className="muted">Create, update, and delete tables</div>
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

        {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
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
            <button className="btn" style={{ marginLeft: 10 }} onClick={expireOverdueConfirmed}>
              Expire overdue (30m)
            </button>
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
                reservationByTableId={reservationByTableId}
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
                <aside className="tablesAside tablesAside--open" aria-label="Table details" style={{ maxHeight: '100vh', overflowY: 'auto' }}>
                  <section className="reservationPanel" aria-label="Selected table">
                    <header className="reservationPanel__header">
                      <div>
                        <div className="reservationPanel__title">Table</div>
                        <div className="reservationPanel__subtitle">Right-click for Edit/Delete</div>
                      </div>
                      <div className="reservationPanel__actions">
                        <button type="button" className="detailsCollapseBtn" onClick={() => setSelectedTableId('')}>
                          →
                        </button>
                        {String(selectedRow.status || '') === 'occupied' ? (
                          <button type="button" className="btn" onClick={checkOutCurrent}>
                            Check out
                          </button>
                        ) : null}
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
                        <div className="kv__row">
                          <div className="kv__k">Status</div>
                          <div className="kv__v">{normalizedStatus(selectedRow.status)}</div>
                        </div>
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
                          <div className="kv__row"><div className="kv__k">Currently dining</div><div className="kv__v">—</div></div>
                        )}
                      </div>

                      <div className="rowCard" style={{ marginTop: 12 }}>
                        <div className="rowCard__title">Reservations today</div>
                        <div className="muted" style={{ marginTop: 4 }}>Select a reservation to check in.</div>
                        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
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
                                    <span className="badge badge--neutral">{r.checkedInAt ? 'Checked in' : '—'}</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
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
            />
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
          <div className="imageModal__dialog" style={{ maxWidth: 640 }}>
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

              <label className="field">
                <div className="field__label">Status</div>
                <select
                  className="input"
                  value={editDialog.draft.status}
                  onChange={(e) =>
                    setEditDialog((prev) => ({
                      ...prev,
                      draft: { ...prev.draft, status: e.target.value },
                    }))
                  }
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
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
