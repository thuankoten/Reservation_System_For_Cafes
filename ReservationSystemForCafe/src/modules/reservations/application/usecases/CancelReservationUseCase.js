export class CancelReservationUseCase {
  constructor({ reservationRepo, tableRepo }) {
    this.reservationRepo = reservationRepo
    this.tableRepo = tableRepo
  }

  async execute({ reservation }) {
    await this.reservationRepo.cancelFutureReservation({ reservation })

    if (reservation?.tableId) {
      await this.tableRepo.setStatus({ tableId: reservation.tableId, status: 'available' })
    }
  }
}
