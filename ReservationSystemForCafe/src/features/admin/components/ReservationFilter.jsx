import './ReservationFilter.css'

export default function ReservationFilter({
  value,
  onChange,
  keyword,
  onKeywordChange,
}) {
  return (
    <div className="reservationFilter">
      <input
        className="reservationSearch"
        placeholder="Search by customer, email, table…"
        value={keyword}
        onChange={e =>
          onKeywordChange(e.target.value)
        }
      />

      <select
        className="reservationSelect"
        value={value}
        onChange={e =>
          onChange(e.target.value)
        }
      >
        <option value="all">All</option>
        <option value="hold">Waiting</option>
        <option value="confirmed">Confirmed</option>
        <option value="cancelled">Cancelled</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>
  )
}
