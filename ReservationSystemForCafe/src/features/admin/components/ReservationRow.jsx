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
  onApprove,
  onReject,
}) {
  const navigate = useNavigate()

  const createdAt = toDate(r.createdAt)     // ⏰ lúc nhấn đặt bàn
  const start = toDate(r.startTime)         // 🟢 start time
  const end = toDate(r.endTime)             // 🔴 end time

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
          Table {r.tableNumber ?? r.tableId}
        </div>

        <div className="muted">
          Party: {r.partySize ?? '—'} • Seats:{' '}
          {r.tableSeats ?? '—'}
        </div>

        <div className="muted">
          Customer:{' '}
          {r.customerName ||
            r.userEmail ||
            'Guest'}
        </div>

        {/* ✅ THỜI GIAN KHÁCH NHẤN ĐẶT */}
        <div className="muted">
          Booked at:{' '}
          {createdAt
            ? createdAt.toLocaleString()
            : '—'}
        </div>

        {/* ✅ THỜI GIAN SỬ DỤNG BÀN */}
        <div className="muted">
          Using:{' '}
          {start && end
            ? `${start.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })} → ${end.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })} (${start.toLocaleDateString()})`
            : '—'}
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
