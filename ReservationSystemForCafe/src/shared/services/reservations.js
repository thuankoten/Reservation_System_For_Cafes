import {
  collection,
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { calculateTotalAmount } from '../utils/pricing'
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

export function buildReservationPrice({ tableSeats, durationMinutes }) {
  const totalAmount = calculateTotalAmount({ seats: tableSeats, durationMinutes })
  if (totalAmount == null) return null
  return {
    totalAmount,
  }
}

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
  if (!user?.uid) throw new Error('Please sign in to create a reservation')
  if (!table?.id) throw new Error('Please select a table')

  const name = String(customerName || '').trim()
  const phone = String(customerPhone || '').trim()
  const email = String(customerEmail || '').trim()
  if (!name) throw new Error('Please enter your name')
  if (!phone) throw new Error('Please enter your phone number')
  if (!email) throw new Error('Please enter your email')

  const dur = Number(durationMinutes)
  if (!Number.isFinite(dur) || dur <= 0) throw new Error('Invalid duration')
  if (dur % TIMELINE_CONFIG.stepMinutes !== 0) throw new Error('Duration must be in 30-minute blocks')
  if (dur > TIMELINE_CONFIG.maxDurationMinutes) throw new Error('Duration exceeds max (6h)')

  const seats = Number(table.seats)
  const pricing = buildReservationPrice({ tableSeats: seats, durationMinutes: dur })
  if (!pricing) throw new Error('Table seats must be 2/4/6/8 to calculate price')

  const { startTime, endTime } = computeReservationTimes({
    isoDate,
    startMinutes: Number(startMinutes),
    durationMinutes: dur,
  })

  if (Number.isNaN(startTime.getTime())) throw new Error('Invalid start time')
  if (endTime <= startTime) throw new Error('Invalid time range')

  const now = new Date()
  const holdExpiresAt = new Date(now.getTime() + 5 * 60 * 1000)

  const slotKeys = buildSlotKeys({ startAt: startTime, durationMinutes: dur, stepMinutes: TIMELINE_CONFIG.stepMinutes })

  const reservationsCol = collection(db, 'reservations')
  const reservationRef = doc(reservationsCol)

  await runTransaction(db, async (tx) => {
    const slotRefs = slotKeys.map((key) => doc(db, 'tables', table.id, 'slots', key))

    for (const slotRef of slotRefs) {
      const snap = await tx.get(slotRef)

      if (snap.exists()) {
        const data = snap.data() || {}
        const existingExpiresAt = typeof data?.expiresAt?.toDate === 'function' ? data.expiresAt.toDate() : data.expiresAt
        const isExpired = existingExpiresAt instanceof Date ? existingExpiresAt <= now : false

        if (!isExpired) {
          throw new Error('This table is not available for the selected time')
        }
      }
    }

    for (const slotRef of slotRefs) {
      tx.set(slotRef, {
        reservationId: reservationRef.id,
        userId: user.uid,
        status: RESERVATION_STATUS.HOLD,
        expiresAt: holdExpiresAt,
        startTime,
        endTime,
        createdAt: serverTimestamp(),
      })
    }

    tx.set(reservationRef, {
      userId: user.uid,
      userEmail: user.email || null,
      isAnonymous: Boolean(user.isAnonymous),
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
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
      totalAmount: pricing.totalAmount,
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
