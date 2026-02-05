function toDate(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  return new Date(v)
}

function isSameDay(a, b) {
  return a && b && a.toDateString() === b.toDateString()
}

export function searchReservations({ rows, keyword }) {
  if (!String(keyword || '').trim()) return rows || []
  const k = String(keyword).toLowerCase()

  return (rows || []).filter((r) =>
    [r.customerName, r.userEmail, r.tableNumber]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(k))
  )
}

export function filterReservationsByStatus({ rows, filter }) {
  if (filter === 'all') return rows || []
  return (rows || []).filter((r) => r.status === filter)
}

export function groupAdminReservations({ rows }) {
  const filtered = rows || []
  const now = new Date()
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)

  const waiting = []
  const today = []
  const upcoming = []
  const yesterday = []
  const older = []

  filtered.forEach((r) => {
    const start = toDate(r.startTime)
    if (r.status === 'hold') {
      waiting.push(r)
      return
    }
    if (start && isSameDay(start, now)) {
      today.push(r)
      return
    }
    if (start && start > now) {
      upcoming.push(r)
      return
    }
    if (start && isSameDay(start, yesterdayDate)) {
      yesterday.push(r)
      return
    }
    older.push(r)
  })

  const todaySorted = today.slice().sort((a, b) => {
    const toDateSafe = (v) => (typeof v?.toDate === 'function' ? v.toDate() : v ? new Date(v) : null)
    const now = new Date()
    const startA = toDateSafe(a.startTime); const endA = toDateSafe(a.endTime)
    const startB = toDateSafe(b.startTime); const endB = toDateSafe(b.endTime)
    const checkedInA = Boolean(toDateSafe(a.checkedInAt)); const checkedOutA = Boolean(toDateSafe(a.checkedOutAt))
    const checkedInB = Boolean(toDateSafe(b.checkedInAt)); const checkedOutB = Boolean(toDateSafe(b.checkedOutAt))
    const statusA = String(a.status || '').toLowerCase()
    const statusB = String(b.status || '').toLowerCase()
    const overdueA = (!checkedInA && (((startA && startA.getTime() < now.getTime() - 30 * 60 * 1000)) || (endA && endA < now)))
    const overdueB = (!checkedInB && (((startB && startB.getTime() < now.getTime() - 30 * 60 * 1000)) || (endB && endB < now)))
    const isActiveA = statusA !== 'cancelled' && statusA !== 'expired' && !checkedOutA && !overdueA
    const isActiveB = statusB !== 'cancelled' && statusB !== 'expired' && !checkedOutB && !overdueB
    if (isActiveA !== isActiveB) return isActiveA ? -1 : 1
    const tA = startA?.getTime?.() || 0
    const tB = startB?.getTime?.() || 0
    return tA - tB
  })

  const sortByStartAsc = (list) => list.slice().sort((a, b) => {
    const ta = toDate(a.startTime)?.getTime?.() || 0
    const tb = toDate(b.startTime)?.getTime?.() || 0
    return ta - tb
  })

  const upcomingSorted = sortByStartAsc(upcoming)
  const yesterdaySorted = sortByStartAsc(yesterday)
  const olderSorted = sortByStartAsc(older)

  return {
    waiting,
    todaySorted,
    upcomingSorted,
    yesterdaySorted,
    olderSorted,
  }
}
