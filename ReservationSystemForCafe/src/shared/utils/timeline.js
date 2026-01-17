const OPEN_MINUTES = 8 * 60
const CLOSE_MINUTES = 23 * 60
const STEP_MINUTES = 30

export const TIMELINE_CONFIG = {
  openMinutes: OPEN_MINUTES,
  closeMinutes: CLOSE_MINUTES,
  stepMinutes: STEP_MINUTES,
  maxDurationMinutes: 6 * 60,
}

export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function formatISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function minutesToTimeLabel(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${pad2(h)}:${pad2(m)}`
}

export function buildDateFromISOAndMinutes(isoDate, minutesFromMidnight) {
  const [y, m, d] = isoDate.split('-').map((v) => Number(v))
  const base = new Date(y, m - 1, d, 0, 0, 0, 0)
  base.setMinutes(Number(minutesFromMidnight) || 0)
  return base
}

export function listDurationOptions({ stepMinutes = STEP_MINUTES, maxDurationMinutes = TIMELINE_CONFIG.maxDurationMinutes } = {}) {
  const out = []
  for (let mins = stepMinutes; mins <= maxDurationMinutes; mins += stepMinutes) out.push(mins)
  return out
}

export function listStartMinutesForDuration({
  openMinutes = OPEN_MINUTES,
  closeMinutes = CLOSE_MINUTES,
  stepMinutes = STEP_MINUTES,
  durationMinutes,
}) {
  const dur = Number(durationMinutes)
  if (!Number.isFinite(dur) || dur <= 0) return []

  const latestStart = closeMinutes - dur
  const out = []
  for (let m = openMinutes; m <= latestStart; m += stepMinutes) out.push(m)
  return out
}

export function clampDurationMinutes(durationMinutes) {
  const mins = Number(durationMinutes)
  if (!Number.isFinite(mins)) return STEP_MINUTES
  const stepped = Math.round(mins / STEP_MINUTES) * STEP_MINUTES
  return Math.max(STEP_MINUTES, Math.min(TIMELINE_CONFIG.maxDurationMinutes, stepped))
}
