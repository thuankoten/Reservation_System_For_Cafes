export class ApproveReservationUseCase {
  constructor({ reservationRepo, tableRepo }) {
    this.reservationRepo = reservationRepo
    this.tableRepo = tableRepo
  }

  async execute({ reservation }) {
    if (!reservation?.id) throw new Error('Missing reservation')

    await this.reservationRepo.setStatus({
      reservationId: reservation.id,
      status: 'confirmed',
      extraUpdates: { confirmedAt: new Date() },
    })

    if (reservation.tableId) {
      await this.tableRepo.setStatus({ tableId: reservation.tableId, status: 'reserved' })
    }
  }
}
