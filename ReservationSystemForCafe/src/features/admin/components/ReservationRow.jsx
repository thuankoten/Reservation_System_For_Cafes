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
  const createdAt = toDate(r.createdAt)
  const status = String(r.status || '').toLowerCase()
  const isDiningNow = status === 'occupied'
  const canCancel =
    r.status === 'confirmed' &&
    start &&
    start > new Date()

  // Calculate duration in hours
  const durationMs = end && start ? end.getTime() - start.getTime() : 0
  const durationHours = durationMs / (1000 * 60 * 60)
  const durationStr = durationHours >= 1 
    ? `${durationHours.toFixed(1)}h` 
    : `${Math.round(durationMs / (1000 * 60))}m`

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
        <div className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
          Created: {createdAt?.toLocaleString()}
        </div>
        <div className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
          Party: {r.partySize} • {durationStr} • {start?.toLocaleString()}
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
