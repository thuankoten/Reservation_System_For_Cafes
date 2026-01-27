import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../../../shared/firebase'
import StatusBadge from '../../../shared/components/StatusBadge'
import './AdminReservationDetailPage.css'

export default function AdminReservationDetailPage() {
  const { reservationId } = useParams()
  const navigate = useNavigate()
  const [r, setR] = useState(null)
  const [loading, setLoading] = useState(true)

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
    </div>
  </div>
)
}
