import './StatusBadge.css'

export default function StatusBadge({ status }) {
  const raw = String(status || '')
  const s = raw.trim().toLowerCase()
  const label = s === 'hold' ? 'waiting' : raw
  return <span className={`statusBadge statusBadge--${status}`}>{label}</span>
}
