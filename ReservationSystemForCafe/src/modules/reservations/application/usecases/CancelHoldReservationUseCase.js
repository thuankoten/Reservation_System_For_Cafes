export class CancelHoldReservationUseCase {
  constructor({ reservationRepo }) {
    this.reservationRepo = reservationRepo
  }

  async execute({ reservation }) {
    if (!reservation?.id) throw new Error('Missing reservation')
    await this.reservationRepo.cancelReservation({
      reservationId: reservation.id,
      tableId: reservation.tableId,
      slotKeys: reservation.slotKeys,
    })
  }
}
