export class CreateHoldReservationUseCase {
  constructor({ reservationRepo }) {
    this.reservationRepo = reservationRepo
  }

  async execute({ user, table, isoDate, startMinutes, durationMinutes, partySize, customerName, customerPhone, customerEmail }) {
    return this.reservationRepo.createHoldReservation({
      user,
      table,
      isoDate,
      startMinutes,
      durationMinutes,
      partySize,
      customerName,
      customerPhone,
      customerEmail,
    })
  }
}
