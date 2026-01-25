import './StatusBadge.css'

export default function StatusBadge({ status }) {
  return <span className={`statusBadge statusBadge--${status}`}>{status}</span>
}
