import { useNavigate } from 'react-router-dom'
import StatusBadge from '../../../shared/components/StatusBadge'
import './ReservationRow.css'

function toDate(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  return new Date(v)
}

export default function ReservationRow({
  r,
  onConfirm,
  onReject,
  onCancel,
}) {
  const navigate = useNavigate()
  const start = toDate(r.startTime)
  const end = toDate(r.endTime)
  const checkedInAt = toDate(r.checkedInAt)
  const checkedOutAt = toDate(r.checkedOutAt)
  const now = new Date()
  const status = String(r.status || '').toLowerCase()
  const isDiningNow = status === 'occupied'
  const isCompleted = status === 'completed'
  const canCancel =
    r.status === 'confirmed' &&
    start &&
    start > new Date()

  return (
    <div
      className="reservationRow"
      onClick={() =>
        navigate(`/admin/dashboard/reservations/${r.id}`)
      }
    >
      <div>
        <b>Table {r.tableNumber}</b>
        <div className="muted">
          {r.customerName || r.userEmail}
        </div>
        <div className="muted">
          {start?.toLocaleString()}
        </div>
      </div>

      <div
        className="reservationActions"
        onClick={e => e.stopPropagation()}
      >
        <StatusBadge status={r.status} />
        {isDiningNow ? (
          <span className="badge badge--neutral" style={{ marginLeft: 6 }}>Dining now</span>
        ) : null}
        {/* {isCompleted ? (
          <span className="badge badge--neutral" style={{ marginLeft: 6 }}>Completed</span>
        ) : null} */}

        {r.status === 'hold' && (
          <>
            <button
              className="btn btn--primary"
              onClick={() => onConfirm(r)}
            >
              Confirm
            </button>
            <button
              className="btn"
              onClick={() => onReject(r)}
            >
              Reject
            </button>
          </>
        )}

        {canCancel && (
          <button
            className="btn btn--danger"
            onClick={() => onCancel(r)}
          >
            Cancel
          </button>
        )}

      </div>
    </div>
  )
}
