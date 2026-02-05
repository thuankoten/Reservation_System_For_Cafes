export class ExpireOverdueReservationsUseCase {
  constructor({ reservationRepo, tableRepo }) {
    this.reservationRepo = reservationRepo
    this.tableRepo = tableRepo
  }

  toDate(v) {
    if (!v) return null
    if (typeof v?.toDate === 'function') return v.toDate()
    try { return new Date(v) } catch { return null }
  }

  async execute({ reservations }) {
    const now = Date.now()
    const startCutoffMs = now - 30 * 60 * 1000

    const toExpireConfirmed = (reservations || []).filter((r) => {
      const s = String(r.status || '').toLowerCase()
      if (s !== 'confirmed') return false
      if (r.checkedInAt) return false
      const start = this.toDate(r.startTime)
      const end = this.toDate(r.endTime)
      const startOk = start instanceof Date && start.getTime() < startCutoffMs
      const endPassed = end instanceof Date && end.getTime() < now
      return Boolean(startOk || endPassed)
    })

    const toExpireHolds = (reservations || []).filter((r) => {
      const s = String(r.status || '').toLowerCase()
      if (s !== 'hold') return false
      const hold = this.toDate(r.holdExpiresAt)
      return hold instanceof Date && hold.getTime() < now
    })

    for (const r of toExpireConfirmed) {
      await this.reservationRepo.setStatus({
        reservationId: r.id,
        status: 'expired',
        extraUpdates: { expiredAt: new Date() },
      })
      if (r.tableId) {
        await this.tableRepo.setStatus({ tableId: r.tableId, status: 'available' })
      }
    }

    for (const r of toExpireHolds) {
      await this.reservationRepo.setStatus({
        reservationId: r.id,
        status: 'expired',
        extraUpdates: { expiredAt: new Date() },
      })
    }
  }
}
