export class RejectReservationUseCase {
  constructor({ reservationRepo, tableRepo }) {
    this.reservationRepo = reservationRepo
    this.tableRepo = tableRepo
  }

  async execute({ reservation }) {
    if (!reservation?.id) throw new Error('Missing reservation')

    await this.reservationRepo.setStatus({
      reservationId: reservation.id,
      status: 'rejected',
      extraUpdates: { rejectedAt: new Date() },
    })

    if (reservation.tableId) {
      await this.tableRepo.setStatus({ tableId: reservation.tableId, status: 'available' })
    }
  }
}
