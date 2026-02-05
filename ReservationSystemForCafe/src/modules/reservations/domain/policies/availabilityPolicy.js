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

export function getReservedTableIdsForRange({ reservations, isoDate, startDate, endDate }) {
  const now = new Date()
  const set = new Set()
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return set
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return set
  if (endDate <= startDate) return set

  for (const r of reservations || []) {
    if (!r?.tableId) continue
    const status = String(r.status || '').toLowerCase()
    if (status !== 'confirmed' && status !== 'hold') continue
    if (status === 'hold') {
      const expiresAt = toDate(r.holdExpiresAt)
      if (!expiresAt || expiresAt <= now) continue
    }
    if (status === 'confirmed') {
      const rEndCheck = toDate(r.endTime)
      if (!(rEndCheck instanceof Date) || Number.isNaN(rEndCheck.getTime())) continue
      if (rEndCheck <= now) continue
    }
    const rStart = toDate(r.startTime)
    const rEnd = toDate(r.endTime)
    if (!(rStart instanceof Date) || !(rEnd instanceof Date)) continue
    if (Number.isNaN(rStart.getTime()) || Number.isNaN(rEnd.getTime())) continue
    if (formatISODate(rStart) !== isoDate) continue
    const overlaps = rStart < endDate && rEnd > startDate
    if (overlaps) set.add(r.tableId)
  }
  return set
}
