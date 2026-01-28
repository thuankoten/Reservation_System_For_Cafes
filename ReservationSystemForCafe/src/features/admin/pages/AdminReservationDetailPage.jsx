import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../../../shared/firebase'
import StatusBadge from '../../../shared/components/StatusBadge'
import './AdminReservationDetailPage.css'
import { checkInReservation as adminCheckIn, checkOutTable as adminCheckOut } from '../../../shared/services/admin/reservations'

export default function AdminReservationDetailPage() {
  const { reservationId } = useParams()
  const navigate = useNavigate()
  const [r, setR] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const snap = await getDoc(
        doc(db, 'reservations', reservationId)
      )
      if (snap.exists()) {
        setR({ id: snap.id, ...snap.data() })
      }
      setLoading(false)
    }
    load()
  }, [reservationId])

  if (loading) return <div>Loading...</div>
  if (!r) return <div>Reservation not found</div>

  const toDate = (v) => {
    if (!v) return null
    if (typeof v?.toDate === 'function') return v.toDate()
    try { return new Date(v) } catch { return null }
  }

  const start = toDate(r.startTime)
  const end = toDate(r.endTime)
  const now = new Date()
  const status = String(r.status || '').toLowerCase()
  const isConfirmed = status === 'confirmed'
  const isWithinWindow = start && end && start <= now && now <= end
  const canCheckIn = isConfirmed && isWithinWindow && !r.checkedInAt
  const canCheckOut = isConfirmed && !!r.checkedInAt && !r.checkedOutAt

  async function handleCheckIn() {
    setError('')
    try {
      await adminCheckIn({ db, reservationId: r.id, tableId: r.tableId })
      const snap = await getDoc(doc(db, 'reservations', reservationId))
      if (snap.exists()) setR({ id: snap.id, ...snap.data() })
    } catch (e) {
      setError(e?.message || 'Failed to check in')
    }
  }

  async function handleCheckOut() {
    setError('')
    try {
      await adminCheckOut({ db, tableId: r.tableId, reservationId: r.id, keepReserved: false })
      const snap = await getDoc(doc(db, 'reservations', reservationId))
      if (snap.exists()) setR({ id: snap.id, ...snap.data() })
    } catch (e) {
      setError(e?.message || 'Failed to check out')
    }
  }


  return (
  <div
    className="reservationDetailOverlay"
    onClick={() => navigate(-1)}
  >
    <div
      className="reservationDetailCard"
      onClick={(e) => e.stopPropagation()}
    >
      <button className="backLink" onClick={() => navigate(-1)}>
        ✕ Close
      </button>

      <div className="detailHeader">
        <h2>Reservation Detail</h2>
        <StatusBadge status={r.status} />
      </div>

      <div className="detailRow">
        <span>Customer</span>
        <span>{r.customerName || 'Guest'}</span>
      </div>

      <div className="detailRow">
        <span>Phone</span>
        <span>{r.customerPhone || '—'}</span>
      </div>

      <div className="detailRow">
        <span>Email</span>
        <span>{r.customerEmail || r.userEmail || '—'}</span>
      </div>

      <div className="detailRow">
        <span>Table</span>
        <span>{r.tableNumber}</span>
      </div>

      <div className="detailRow">
        <span>Party size</span>
        <span>{r.partySize}</span>
      </div>

      <div className="detailRow">
        <span>Time</span>
        <span>
          {new Date(r.startTime?.toDate?.() || r.startTime).toLocaleString()}
          {' → '}
          {new Date(r.endTime?.toDate?.() || r.endTime).toLocaleString()}
        </span>
      </div>

      <div className="detailRow">
        <span>Created at</span>
        <span>
          {new Date(r.createdAt?.toDate?.() || r.createdAt).toLocaleString()}
        </span>
      </div>

      {error ? (
        <div className="muted" style={{ color: 'red', marginTop: 8 }}>{error}</div>
      ) : null}

      {isConfirmed ? (
        <div className="detailActions" style={{ marginTop: 16, display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
          {canCheckIn ? (
            <button className="btn btn--primary" onClick={handleCheckIn}>Check in</button>
          ) : null}
          {canCheckOut ? (
            <button className="btn" onClick={handleCheckOut}>Check out</button>
          ) : null}
        </div>
      ) : null}
    </div>
  </div>
)
}
