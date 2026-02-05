export class CreateTableUseCase {
  constructor({ tableRepo }) {
    this.tableRepo = tableRepo
  }

  toInt(value, fallback) {
    const n = Number.parseInt(String(value), 10)
    return Number.isFinite(n) ? n : fallback
  }

  async execute({ draft, existingTables }) {
    if (!draft) throw new Error('Missing draft')

    const number = this.toInt(draft.number, NaN)
    const seats = this.toInt(draft.seats, NaN)
    const floor = this.toInt(draft.floor, NaN)

    if (!Number.isFinite(number) || number <= 0) throw new Error('Table number must be a positive integer')
    if (!Number.isFinite(seats) || seats <= 0) throw new Error('Seats must be a positive integer')

    const SEATS_OPTIONS = [2, 4, 6, 8]
    if (!SEATS_OPTIONS.includes(seats)) throw new Error('Seats must be one of: 2, 4, 6, 8')

    const FLOOR_OPTIONS = [1, 2, 3]
    if (!FLOOR_OPTIONS.includes(floor)) throw new Error('Floor must be one of: 1, 2, 3')

    const STATUS_OPTIONS = ['available', 'reserved', 'occupied']
    if (!STATUS_OPTIONS.includes(String(draft.status || '').toLowerCase())) throw new Error('Invalid status')

    const placement = String(draft.placement || '').trim()
    if (!placement) throw new Error('Please choose a placement option')

    const exists = (existingTables || []).some((r) => Number(r.number) === number)
    if (exists) throw new Error('A table with this number already exists')

    const imageUrlTrimmed = String(draft.imageUrl || '').trim()
    let normalizedImageUrl = imageUrlTrimmed
    if (imageUrlTrimmed) {
      try {
        const u = new URL(imageUrlTrimmed)
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          throw new Error('Image URL must start with http:// or https://')
        }
        normalizedImageUrl = u.toString()
      } catch (e) {
        throw new Error(e?.message || 'Image URL is not valid')
      }
    }

    await this.tableRepo.create({
      table: {
        number,
        seats,
        floor,
        status: String(draft.status || '').toLowerCase(),
        placement,
        imageUrl: normalizedImageUrl,
      },
    })
  }
}
