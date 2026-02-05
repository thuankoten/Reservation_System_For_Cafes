export class CheckOutReservationUseCase {
  constructor({ reservationRepo, tableRepo }) {
    this.reservationRepo = reservationRepo
    this.tableRepo = tableRepo
  }

  async execute({ reservation, keepReserved = false }) {
    if (!reservation?.id) throw new Error('Missing reservation')
    if (!reservation.tableId) throw new Error('Missing tableId')

    await this.reservationRepo.setStatus({
      reservationId: reservation.id,
      status: 'completed',
      extraUpdates: { checkedOutAt: new Date() },
    })

    await this.tableRepo.setStatus({
      tableId: reservation.tableId,
      status: keepReserved ? 'reserved' : 'available',
    })
  }
}
