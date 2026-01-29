import { doc, serverTimestamp, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore'

export async function setTableStatus({ db, tableId, status }) {
  if (!tableId) throw new Error('Missing tableId')
  await updateDoc(doc(db, 'tables', tableId), {
    status,
    updatedAt: serverTimestamp(),
  })
}

export async function updateTable({ db, tableId, updates }) {
  if (!tableId) throw new Error('Missing tableId')
  await updateDoc(doc(db, 'tables', tableId), {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function removeTable({ db, tableId }) {
  if (!tableId) throw new Error('Missing tableId')
  await deleteDoc(doc(db, 'tables', tableId))
}

export async function assignFloors({ db, tables }) {
  const sorted = (tables || [])
    .slice()
    .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))
  const perFloor = Math.max(1, Math.ceil(sorted.length / 3))
  const batch = writeBatch(db)
  for (let i = 0; i < sorted.length; i += 1) {
    const r = sorted[i]
    const floor = Math.min(3, Math.max(1, Math.floor(i / perFloor) + 1))
    batch.update(doc(db, 'tables', r.id), {
      floor,
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

/**
 * Save table edits (number, seats, floor, imageUrl)
 */
export async function saveTableEdit({ db, tableId, draft, existingTables }) {
  if (!tableId || !draft) throw new Error('Missing tableId or draft')

  const toInt = (value, fallback) => {
    const n = Number.parseInt(String(value), 10)
    return Number.isFinite(n) ? n : fallback
  }

  const number = toInt(draft.number, NaN)
  const seats = toInt(draft.seats, NaN)
  const floor = toInt(draft.floor, NaN)

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error('Table number must be a positive integer')
  }
  if (!Number.isFinite(seats) || seats <= 0) {
    throw new Error('Seats must be a positive integer')
  }

  const SEATS_OPTIONS = [2, 4, 6, 8]
  if (!SEATS_OPTIONS.includes(seats)) {
    throw new Error('Seats must be one of: 2, 4, 6, 8')
  }

  const exists = existingTables.some((r) => r.id !== tableId && Number(r.number) === number)
  if (exists) {
    throw new Error('Another table already has this number')
  }

  const payload = {
    number,
    seats,
    floor,
    updatedAt: serverTimestamp(),
  }
  if (draft.imageUrl && typeof draft.imageUrl === 'string' && draft.imageUrl.length > 0) {
    payload.imageUrl = draft.imageUrl
  }
  await updateDoc(doc(db, 'tables', tableId), payload)
}
