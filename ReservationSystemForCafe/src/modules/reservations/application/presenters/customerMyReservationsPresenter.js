import { formatISODate } from '../../../../shared/utils/timeline'

function toDate(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  try {
    return new Date(v)
  } catch {
    return null
  }
}

export function buildMyReservationRows({ myReservations }) {
  const now = new Date()
  return (myReservations || []).map((r) => {
    const status = String(r.status || '').toLowerCase()
    const expiresAt = toDate(r.holdExpiresAt)
    const startTime = toDate(r.startTime)
    const endTime = toDate(r.endTime)
    const isHoldActive = status === 'hold' && expiresAt && expiresAt > now
    const statusLabel =
      status === 'confirmed'
        ? 'Confirmed'
        : status === 'hold'
          ? (isHoldActive ? 'Pending approval' : 'Expired')
          : status || '—'
    return {
      ...r,
      _status: status,
      _expiresAt: expiresAt,
      _startTime: startTime,
      _endTime: endTime,
      _isHoldActive: isHoldActive,
      _statusLabel: statusLabel,
    }
  })
}

export function groupMyReservations({ myReservationRows }) {
  const rows = (myReservationRows || []).filter((r) => r._startTime instanceof Date && !Number.isNaN(r._startTime.getTime()))

  const todayIso = formatISODate(new Date())
  const d = new Date()
  const yesterday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
  const yesterdayIso = formatISODate(yesterday)

  const statusPriority = (s) => {
    const k = String(s || '').toLowerCase()
    if (k === 'confirmed') return 0
    if (k === 'occupied') return 1
    if (k === 'completed') return 2
    if (k === 'expired') return 3
    if (k === 'cancelled' || k === 'rejected') return 9
    return 5
  }

  const sorter = (a, b) => {
    const pa = statusPriority(a._status)
    const pb = statusPriority(b._status)
    if (pa !== pb) return pa - pb
    const ta = a._startTime?.getTime?.() || 0
    const tb = b._startTime?.getTime?.() || 0
    return ta - tb
  }

  const waitingToday = rows
    .filter((r) => r._status === 'hold' && r._isHoldActive && formatISODate(r._startTime) === todayIso)
    .slice()
    .sort((a, b) => (a._startTime - b._startTime))

  const waitingUpcoming = rows
    .filter((r) => r._status === 'hold' && r._isHoldActive && formatISODate(r._startTime) !== todayIso && r._startTime > new Date())
    .slice()
    .sort((a, b) => (a._startTime - b._startTime))

  const today = rows
    .filter((r) => r._status !== 'hold' && formatISODate(r._startTime) === todayIso)
    .slice()
    .sort(sorter)

  const upcoming = rows
    .filter((r) => r._status !== 'hold' && formatISODate(r._startTime) !== todayIso && r._startTime > new Date())
    .slice()
    .sort(sorter)

  const yday = rows
    .filter((r) => r._status !== 'hold' && formatISODate(r._startTime) === yesterdayIso)
    .slice()
    .sort(sorter)

  const older = rows
    .filter((r) => r._status !== 'hold' && r._startTime < new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()))
    .slice()
    .sort(sorter)

  return { waitingToday, waitingUpcoming, today, upcoming, yday, older }
}
