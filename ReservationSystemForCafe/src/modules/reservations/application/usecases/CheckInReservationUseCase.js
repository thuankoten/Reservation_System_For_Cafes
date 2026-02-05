export class CheckInReservationUseCase {
  constructor({ reservationRepo, tableRepo }) {
    this.reservationRepo = reservationRepo
    this.tableRepo = tableRepo
  }

  async execute({ reservation }) {
    if (!reservation?.id) throw new Error('Missing reservation')
    if (!reservation.tableId) throw new Error('Missing tableId')

    await this.reservationRepo.setStatus({
      reservationId: reservation.id,
      status: 'occupied',
      extraUpdates: { checkedInAt: new Date() },
    })

    await this.tableRepo.setStatus({
      tableId: reservation.tableId,
      status: 'occupied',
    })
  }
}
