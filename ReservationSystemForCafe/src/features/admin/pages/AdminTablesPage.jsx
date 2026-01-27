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

  const reservationByTableId = useMemo(() => {
    const map = new Map()
    for (const r of activeReservations) {
      if (!r.tableId) continue
      if (!map.has(r.tableId)) map.set(r.tableId, r)
    }
    return map
  }, [activeReservations])

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
                <aside className="tablesAside tablesAside--open" aria-label="Table details">
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
                          <div className="kv__v">{String(selectedRow.status || 'available')}</div>
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
