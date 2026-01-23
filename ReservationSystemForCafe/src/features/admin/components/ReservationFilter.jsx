import './ReservationFilter.css'
export default function ReservationFilter({ value, onChange }) {
  return (
    <select
      className="reservationFilter"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="all">All</option>
      <option value="hold">Hold (Waiting)</option>
      <option value="confirmed">Confirmed</option>
      <option value="expired">Expired</option>
      <option value="rejected">Rejected</option>
    </select>
  )
}
