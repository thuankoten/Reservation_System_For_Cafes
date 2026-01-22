import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../../../shared/firebase'

const STATUS_OPTIONS = [
  { value: 'available', label: 'Free (available)' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'occupied', label: 'Occupied' },
]

const SEATS_OPTIONS = [2, 4, 6, 8]
const FLOOR_OPTIONS = [1, 2, 3]

const PLACEMENT_OPTIONS = [
  { value: 'quiet_zone', label: 'Quiet Zone' },
  { value: 'window_seat', label: 'Window Seat' },
  { value: 'near_power_outlets', label: 'Near power outlets' },
]

function toInt(value, fallback) {
  const n = Number.parseInt(String(value), 10)
  return Number.isFinite(n) ? n : fallback
}

export default function AdminCreateTablePage() {
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [loadingTables, setLoadingTables] = useState(true)

  const [number, setNumber] = useState('')
  const [seats, setSeats] = useState('2')
  const [floor, setFloor] = useState('1')
  const [status, setStatus] = useState('available')
  const [placement, setPlacement] = useState(PLACEMENT_OPTIONS[0].value)
  const [imageFile, setImageFile] = useState(null)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'tables'), orderBy('number', 'asc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoadingTables(false)
      },
      () => {
        setRows([])
        setLoadingTables(false)
      }
    )
    return () => unsub()
  }, [])

  const numberSet = useMemo(() => new Set(rows.map((r) => Number(r.number))), [rows])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')

    const n = toInt(number, NaN)
    const s = toInt(seats, NaN)
    const f = toInt(floor, NaN)

    if (!Number.isFinite(n) || n <= 0) {
      setError('Table number must be a positive integer')
      return
    }
    if (!Number.isFinite(s) || s <= 0) {
      setError('Seats must be a positive integer')
      return
    }

    if (!SEATS_OPTIONS.includes(s)) {
      setError('Seats must be one of: 2, 4, 6, 8')
      return
    }
    if (!FLOOR_OPTIONS.includes(f)) {
      setError('Floor must be one of: 1, 2, 3')
      return
    }

    if (!PLACEMENT_OPTIONS.some((o) => o.value === placement)) {
      setError('Please choose a placement option')
      return
    }

    if (!loadingTables && numberSet.has(n)) {
      setError('A table with this number already exists')
      return
    }

    setSubmitting(true)
    try {
      let imageUrl = ''
      if (imageFile) {
        const safeName = String(imageFile.name || 'table.jpg').replace(/[^a-zA-Z0-9_.-]/g, '_')
        const path = `table-images/${n}-${Date.now()}-${safeName}`
        const storageRef = ref(storage, path)
        await uploadBytes(storageRef, imageFile)
        imageUrl = await getDownloadURL(storageRef)
      }

      await addDoc(collection(db, 'tables'), {
        number: n,
        seats: s,
        floor: f,
        status,
        placement,
        imageUrl,
        updatedAt: serverTimestamp(),
      })

      navigate('/admin/dashboard/tables', { replace: true })
    } catch (err) {
      setError(err?.message || 'Failed to create table')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div>
            <h2 className="pageTitle">Add table</h2>
            <div className="muted">Fill in table information</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn" type="button" onClick={() => navigate('/admin/dashboard/tables')}>Back</button>
            <button className="btn btn--primary" type="submit" form="adminCreateTableForm" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>

        {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}

        <form id="adminCreateTableForm" onSubmit={onSubmit} className="stack" style={{ marginTop: 12 }} noValidate>
          <label className="field">
            <div className="field__label">Number</div>
            <input className="input" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. 1" />
          </label>

          <label className="field">
            <div className="field__label">Seats</div>
            <select className="input" value={seats} onChange={(e) => setSeats(e.target.value)}>
              {SEATS_OPTIONS.map((s) => (
                <option key={s} value={String(s)}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <div className="field__label">Floor</div>
            <select className="input" value={floor} onChange={(e) => setFloor(e.target.value)}>
              {FLOOR_OPTIONS.map((f) => (
                <option key={f} value={String(f)}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <div className="field__label">Status</div>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <div className="field__label">Placement</div>
            <select className="input" value={placement} onChange={(e) => setPlacement(e.target.value)}>
              {PLACEMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <div className="field__label">Image (jpg/png)</div>
            <input
              className="input"
              type="file"
              accept="image/*,.jpg,.jpeg,.png"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </label>
        </form>
      </div>
    </div>
  )
}
