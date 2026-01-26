import { pad2 } from './timeline'

export function formatSlotKey(date) {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  const hh = pad2(date.getHours())
  const mm = pad2(date.getMinutes())
  return `${y}-${m}-${d}_${hh}:${mm}`
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

export function buildSlotKeys({ startAt, durationMinutes, stepMinutes = 30 }) {
  const start = startAt instanceof Date ? startAt : new Date(startAt)
  const dur = Number(durationMinutes)
  if (!Number.isFinite(start.getTime())) return []
  if (!Number.isFinite(dur) || dur <= 0) return []

  const slots = []
  const count = Math.ceil(dur / stepMinutes)
  for (let i = 0; i < count; i += 1) {
    const slotStart = addMinutes(start, i * stepMinutes)
    slots.push(formatSlotKey(slotStart))
  }
  return slots
}
