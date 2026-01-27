import {
  collection,
  deleteField,
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { buildDateFromISOAndMinutes, TIMELINE_CONFIG } from '../utils/timeline'
import { buildSlotKeys, addMinutes } from '../utils/slotKeys'

export const RESERVATION_STATUS = {
  HOLD: 'hold',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
}

export function computeReservationTimes({ isoDate, startMinutes, durationMinutes }) {
  const startTime = buildDateFromISOAndMinutes(isoDate, startMinutes)
  const endTime = addMinutes(startTime, Number(durationMinutes) || 0)
  return { startTime, endTime }
}

// Pricing removed from reservation creation to simplify customer flow.

export async function createHoldReservation({
  db,
  user,
  table,
  isoDate,
  startMinutes,
  durationMinutes,
  partySize,
  customerName,
  customerPhone,
  customerEmail,
}) {
  if (!db) throw new Error('Missing Firestore db')
  if (!table?.id) throw new Error('Please select a table')

  const name = String(customerName || '').trim()
  const phone = String(customerPhone || '').trim()
  const email = String(customerEmail || '').trim()
  // Name is optional; use provided value or keep null. Phone required; email optional.
  if (!phone) throw new Error('Please enter your phone number')

  const dur = Number(durationMinutes)
  if (!Number.isFinite(dur) || dur <= 0) throw new Error('Invalid duration')
  if (dur % TIMELINE_CONFIG.stepMinutes !== 0) throw new Error('Duration must be in 30-minute blocks')
  if (dur > TIMELINE_CONFIG.maxDurationMinutes) throw new Error('Duration exceeds max (6h)')

  const seats = Number(table.seats)

  const { startTime, endTime } = computeReservationTimes({
    isoDate,
    startMinutes: Number(startMinutes),
    durationMinutes: dur,
  })

  if (Number.isNaN(startTime.getTime())) throw new Error('Invalid start time')
  if (endTime <= startTime) throw new Error('Invalid time range')

  // Hold remains valid until the reservation start time; if not confirmed by then, it will be cancelled.
  const holdExpiresAt = startTime

  const reservationsCol = collection(db, 'reservations')
  const reservationRef = doc(reservationsCol)

  const slotKeys = buildSlotKeys({ startAt: startTime, durationMinutes: dur, stepMinutes: TIMELINE_CONFIG.stepMinutes })

  // For HOLD: block slots immediately with HOLD status until start time
  await runTransaction(db, async (tx) => {
    const slotRefs = slotKeys.map((key) => doc(db, 'tables', table.id, 'slots', key))

    for (const slotRef of slotRefs) {
      const snap = await tx.get(slotRef)
      if (snap.exists()) {
        const data = snap.data() || {}
        const now = new Date()
        const existingExpiresAt = typeof data?.expiresAt?.toDate === 'function' ? data.expiresAt.toDate() : data.expiresAt
        const slotEnd = typeof data?.endTime?.toDate === 'function' ? data.endTime.toDate() : data.endTime
        const expiredByHold = existingExpiresAt instanceof Date ? existingExpiresAt <= now : false
        const expiredByEnd = slotEnd instanceof Date ? slotEnd <= now : false
        const isStale = expiredByHold || expiredByEnd
        if (!isStale) throw new Error('This table is not available for the selected time')
      }
    }

    for (const slotRef of slotRefs) {
      tx.set(slotRef, {
        reservationId: reservationRef.id,
        userId: user?.uid ?? null,
        status: RESERVATION_STATUS.HOLD,
        expiresAt: holdExpiresAt,
        startTime,
        endTime,
        createdAt: serverTimestamp(),
      })
    }

    tx.set(reservationRef, {
      userId: user?.uid ?? null,
      userEmail: (user?.email || email) || null,
      isAnonymous: Boolean(user?.isAnonymous) || !user?.uid,
      customerName: name || null,
      customerPhone: phone,
      customerEmail: email || null,
      tableId: table.id,
      tableNumber: table.number ?? null,
      tableSeats: seats,
      partySize: Number(partySize) || null,
      startTime,
      endTime,
      durationMinutes: dur,
      status: RESERVATION_STATUS.HOLD,
      holdExpiresAt,
      slotKeys,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })

  return reservationRef.id
}

export async function cancelReservation({ db, reservationId, tableId, slotKeys }) {
  if (!reservationId) throw new Error('Missing reservationId')

  const batch = writeBatch(db)

  if (tableId && Array.isArray(slotKeys)) {
    for (const key of slotKeys) {
      const slotRef = doc(db, 'tables', tableId, 'slots', key)
      batch.delete(slotRef)
    }
  }

  const resRef = doc(db, 'reservations', reservationId)
  batch.update(resRef, {
    status: RESERVATION_STATUS.CANCELLED,
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function confirmHoldReservation({ db, reservationId }) {
  if (!db) throw new Error('Missing Firestore db')
  if (!reservationId) throw new Error('Missing reservationId')

  const now = new Date()
  const resRef = doc(db, 'reservations', reservationId)

  await runTransaction(db, async (tx) => {
    const resSnap = await tx.get(resRef)
    if (!resSnap.exists()) throw new Error('Reservation not found')

    const r = resSnap.data() || {}
    const status = String(r.status || '').toLowerCase()
    if (status !== RESERVATION_STATUS.HOLD) throw new Error('Reservation is not pending')

    const expires = typeof r?.holdExpiresAt?.toDate === 'function' ? r.holdExpiresAt.toDate() : r.holdExpiresAt
    const expiresAtDate = expires instanceof Date ? expires : null
    if (!expiresAtDate || expiresAtDate <= now) throw new Error('Reservation hold has expired')

    const tableId = r.tableId
    const slotKeys = Array.isArray(r.slotKeys) ? r.slotKeys : []
    if (!tableId) throw new Error('Reservation is missing tableId')
    if (!slotKeys.length) throw new Error('Reservation is missing slotKeys')

    // Validate existing HOLD slots belong to this reservation, then upgrade to CONFIRMED
    for (const key of slotKeys) {
      const slotRef = doc(db, 'tables', tableId, 'slots', key)
      const slotSnap = await tx.get(slotRef)
      if (!slotSnap.exists()) throw new Error('Reservation hold has no slots to confirm')
      const s = slotSnap.data() || {}
      if (s.reservationId !== reservationId) throw new Error('Selected time is no longer available')
    }

    for (const key of slotKeys) {
      const slotRef = doc(db, 'tables', tableId, 'slots', key)
      tx.update(slotRef, {
        status: RESERVATION_STATUS.CONFIRMED,
        expiresAt: deleteField(),
        updatedAt: serverTimestamp(),
      })
    }

    tx.update(resRef, {
      status: RESERVATION_STATUS.CONFIRMED,
      confirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

export async function expireReservation({ db, reservationId }) {
  if (!reservationId) return
  await updateDoc(doc(db, 'reservations', reservationId), {
    status: RESERVATION_STATUS.EXPIRED,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteReservationDoc({ db, reservationId }) {
  if (!reservationId) return
  await deleteDoc(doc(db, 'reservations', reservationId))
}
