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
    <div className="reservationDetailPage">
      {/* Back */}
      <button
        className="backLink"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>

      {/* Card */}
      <div className="reservationDetailCard">
        <div className="detailHeader">
            <h2>Reservation Detail</h2>
            <StatusBadge status={r.status} />
        </div>

        <div className="detailRow">
          <span>Table</span>
          <span>{r.tableNumber}</span>
        </div>

        <div className="detailRow">
          <span>Seats</span>
          <span>{r.tableSeats}</span>
        </div>

        <div className="detailRow">
          <span>Party Size</span>
          <span>{r.partySize}</span>
        </div>

        <div className="detailRow">
          <span>Duration</span>
          <span>{r.durationMinutes} mins</span>
        </div>

        <div className="detailRow">
          <span>User</span>
          <span>{r.userEmail || 'Guest'}</span>
        </div>
      </div>
    </div>
  )
}
