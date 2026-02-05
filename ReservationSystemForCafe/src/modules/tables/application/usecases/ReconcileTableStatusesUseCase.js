export class ReconcileTableStatusesUseCase {
  constructor({ tableRepo }) {
    this.tableRepo = tableRepo
  }

  toDate(v) {
    if (!v) return null
    if (typeof v?.toDate === 'function') return v.toDate()
    try { return new Date(v) } catch { return null }
  }

  async execute({ tables, reservations }) {
    if (!Array.isArray(tables) || tables.length === 0) return

    const now = Date.now()
    const relevant = Array.isArray(reservations) ? reservations : []

    for (const t of tables) {
      const tableId = t.id
      if (!tableId) continue

      const currentStatus = String(t.status || '').toLowerCase()

      const mos = this.toDate(t.manualOccupiedSince)
      const mou = this.toDate(t.manualOccupiedUntil)
      const isManualActive = Boolean(mos && !mou)

      let hasDining = false
      let hasUpcomingOrCurrent = false

      for (const r of relevant) {
        if (r.tableId !== tableId) continue
        const st = String(r.status || '').toLowerCase()
        if (st !== 'confirmed' && st !== 'occupied') continue

        const start = this.toDate(r.startTime)
        const end = this.toDate(r.endTime)
        const cin = this.toDate(r.checkedInAt)
        const cout = this.toDate(r.checkedOutAt)

        if (cin && !cout) {
          hasDining = true
          break
        }

        const endMs = end?.getTime?.()
        const startMs = start?.getTime?.()
        if ((typeof endMs === 'number' && endMs >= now) || (!endMs && typeof startMs === 'number' && startMs >= now)) {
          hasUpcomingOrCurrent = true
        }
      }

      let desired = currentStatus
      if (isManualActive) desired = 'occupied'
      else if (hasDining) desired = 'occupied'
      else if (hasUpcomingOrCurrent) desired = 'reserved'
      else desired = 'available'

      if (desired !== currentStatus) {
        await this.tableRepo.setStatus({ tableId, status: desired })
      }
    }
  }
}
