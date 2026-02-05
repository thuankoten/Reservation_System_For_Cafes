export class SaveTableEditUseCase {
  constructor({ tableRepo }) {
    this.tableRepo = tableRepo
  }

  toInt(value, fallback) {
    const n = Number.parseInt(String(value), 10)
    return Number.isFinite(n) ? n : fallback
  }

  async execute({ tableId, draft, existingTables }) {
    if (!tableId || !draft) throw new Error('Missing tableId or draft')

    const number = this.toInt(draft.number, NaN)
    const seats = this.toInt(draft.seats, NaN)
    const floor = this.toInt(draft.floor, NaN)

    if (!Number.isFinite(number) || number <= 0) throw new Error('Table number must be a positive integer')
    if (!Number.isFinite(seats) || seats <= 0) throw new Error('Seats must be a positive integer')

    const SEATS_OPTIONS = [2, 4, 6, 8]
    if (!SEATS_OPTIONS.includes(seats)) throw new Error('Seats must be one of: 2, 4, 6, 8')

    const exists = (existingTables || []).some((r) => r.id !== tableId && Number(r.number) === number)
    if (exists) throw new Error('Another table already has this number')

    const payload = { number, seats, floor, status: draft.status }
    if (draft.imageUrl && typeof draft.imageUrl === 'string' && draft.imageUrl.length > 0) {
      payload.imageUrl = draft.imageUrl
    }

    await this.tableRepo.update({ tableId, updates: payload })
  }
}
