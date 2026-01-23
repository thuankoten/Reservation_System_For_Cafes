import { useNavigate } from 'react-router-dom'
import StatusBadge from '../../../shared/components/StatusBadge'
import './ReservationRow.css'

export default function ReservationRow({
  r,
  onApprove,
  onReject,
}) {
  const navigate = useNavigate()

  return (
    <div
      className="reservationRow"
      onClick={() =>
        navigate(`/admin/dashboard/reservations/${r.id}`)
      }
      style={{ cursor: 'pointer' }}
    >
      <div>
        <div className="reservationTitle">
          Table {r.tableNumber}
        </div>

        <div className="muted">
          Party: {r.partySize} • Seats: {r.tableSeats}
        </div>

        <div className="muted">
          By: {r.userEmail || 'Guest'}
        </div>

        <div className="muted">
          Duration: {r.durationMinutes} mins
        </div>
      </div>

      <div
        className="reservationActions"
        onClick={e => e.stopPropagation()}
      >
        <StatusBadge status={r.status} />

        {r.status === 'hold' && (
          <>
            <button
              className="btn btn--primary"
              onClick={() => onApprove(r)}
            >
              Approve
            </button>

            <button
              className="btn"
              onClick={() => onReject(r)}
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  )
}
