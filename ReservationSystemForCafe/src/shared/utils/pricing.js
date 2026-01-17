export function roundUpToThousands(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return 0
  return Math.ceil(n / 1000) * 1000
}

export function pricePer2hBySeats(seats) {
  const s = Number(seats)
  if (!Number.isFinite(s) || s < 2 || s % 2 !== 0) return null
  // Base: 2 seats = 50k/2h. Every +2 seats = +10k/2h
  return 50_000 + ((s - 2) / 2) * 10_000
}

export function calculateTotalAmount({ seats, durationMinutes }) {
  const pricePer2h = pricePer2hBySeats(seats)
  const mins = Number(durationMinutes)
  if (pricePer2h == null) return null
  if (!Number.isFinite(mins) || mins <= 0) return null

  const hours2Factor = mins / 120
  return Math.round(pricePer2h * hours2Factor)
}

export function calculateDepositAmount({ totalAmount, depositPercent = 0.3 }) {
  const total = Number(totalAmount)
  const p = Number(depositPercent)
  if (!Number.isFinite(total) || total < 0) return null
  if (!Number.isFinite(p) || p <= 0) return 0
  return roundUpToThousands(total * p)
}
