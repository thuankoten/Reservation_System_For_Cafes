import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../../shared/firebase'

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
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newNumber, setNewNumber] = useState('')
  const [newSeats, setNewSeats] = useState('2')
  const [newFloor, setNewFloor] = useState('1')
  const [newStatus, setNewStatus] = useState('available')
  const [creating, setCreating] = useState(false)

  const [editing, setEditing] = useState({})
  const [savingId, setSavingId] = useState('')
  const [deletingId, setDeletingId] = useState('')

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

  const numberSet = useMemo(() => new Set(rows.map((r) => Number(r.number))), [rows])

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

  async function createTable() {
    setError('')
    const number = toInt(newNumber, NaN)
    const seats = toInt(newSeats, NaN)
    const floor = toInt(newFloor, NaN)

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
    if (!FLOOR_OPTIONS.includes(floor)) {
      setError('Floor must be one of: 1, 2, 3')
      return
    }
    if (numberSet.has(number)) {
      setError('A table with this number already exists')
      return
    }

    setCreating(true)
    try {
      await addDoc(collection(db, 'tables'), {
        number,
        seats,
        floor,
        status: newStatus,
        updatedAt: serverTimestamp(),
      })
      setNewNumber('')
      setNewSeats('2')
      setNewFloor('1')
      setNewStatus('available')
    } catch (e) {
      setError(e?.message || 'Failed to create table')
    } finally {
      setCreating(false)
    }
  }

  function beginEdit(r) {
    setEditing((prev) => ({
      ...prev,
      [r.id]: {
        number: r.number ?? '',
        seats: r.seats ?? '',
        floor: r.floor ?? 1,
        status: r.status || 'available',
      },
    }))
  }

  function cancelEdit(id) {
    setEditing((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function saveEdit(id) {
    setError('')
    const draft = editing[id]
    if (!draft) return

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
      cancelEdit(id)
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
        <h2 className="pageTitle">Admin • Tables</h2>
        <div className="muted">Create, update, and delete tables</div>

        {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}

        <div className="adminTableForm" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field__label">Number</div>
            <input className="input" value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="e.g. 1" />
          </label>

          <label className="field">
            <div className="field__label">Seats</div>
            <select className="input" value={newSeats} onChange={(e) => setNewSeats(e.target.value)}>
              {SEATS_OPTIONS.map((s) => (
                <option key={s} value={String(s)}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <div className="field__label">Floor</div>
            <select className="input" value={newFloor} onChange={(e) => setNewFloor(e.target.value)}>
              {FLOOR_OPTIONS.map((f) => (
                <option key={f} value={String(f)}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <div className="field__label">Status</div>
            <select className="input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="field" style={{ alignSelf: 'end' }}>
            <button className="btn btn--primary" disabled={creating} onClick={createTable}>
              {creating ? 'Creating…' : 'Add table'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div>
            <div style={{ fontWeight: 700 }}>All tables</div>
            <div className="muted">Total: {rows.length}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn" disabled={loading || rows.length === 0} onClick={assignFloors}>
              Auto-assign floors
            </button>
            {loading ? <div className="muted">Loading…</div> : null}
          </div>
        </div>

        <div className="adminTableList" style={{ marginTop: 12 }}>
          {rows.length === 0 && !loading ? <div className="muted">No tables yet.</div> : null}

          {rows.map((r) => {
            const draft = editing[r.id]
            const isEditing = Boolean(draft)
            return (
              <div key={r.id} className="rowCard">
                <div style={{ minWidth: 200 }}>
                  <div className="rowCard__title">Table {r.number}</div>
                  {/* <div className="muted">Doc ID: {r.id}</div> */}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
                  <label className="field" style={{ minWidth: 120 }}>
                    <div className="field__label">Number</div>
                    <input
                      className="input"
                      value={isEditing ? draft.number : r.number ?? ''}
                      disabled={!isEditing}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], number: e.target.value },
                        }))
                      }
                    />
                  </label>

                  <label className="field" style={{ minWidth: 120 }}>
                    <div className="field__label">Seats</div>
                    <select
                      className="input"
                      value={isEditing ? String(draft.seats) : String(r.seats ?? '')}
                      disabled={!isEditing}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], seats: e.target.value },
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

                  <label className="field" style={{ minWidth: 120 }}>
                    <div className="field__label">Floor</div>
                    <select
                      className="input"
                      value={isEditing ? String(draft.floor) : String(r.floor ?? 1)}
                      disabled={!isEditing}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], floor: e.target.value },
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

                  <label className="field" style={{ minWidth: 160 }}>
                    <div className="field__label">Status</div>
                    <select
                      className="input"
                      value={isEditing ? draft.status : r.status || 'available'}
                      disabled={!isEditing}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], status: e.target.value },
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

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {!isEditing ? (
                      <>
                        <button className="btn edit-btn" onClick={() => beginEdit(r)}>
                          Edit
                        </button>
                        <button className="btn delete-btn" disabled={deletingId === r.id} onClick={() => removeTable(r.id)}>
                          {deletingId === r.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn--primary" disabled={savingId === r.id} onClick={() => saveEdit(r.id)}>
                          {savingId === r.id ? 'Saving…' : 'Save'}
                        </button>
                        <button className="btn" onClick={() => cancelEdit(r.id)}>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
