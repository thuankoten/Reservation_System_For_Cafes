import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'

import { buildSlotKeys } from '../../../../shared/utils/slotKeys'
import { buildDateFromISOAndMinutes, TIMELINE_CONFIG } from '../../../../shared/utils/timeline'

export class FirestoreReservationRepository {
  constructor({ db }) {
    this.db = db
  }

  subscribeAll({ onNext, onError, orderByField, orderByDirection = 'asc', limitCount } = {}) {
    const parts = [collection(this.db, 'reservations')]
    if (orderByField) parts.push(orderBy(orderByField, orderByDirection))
    if (Number.isFinite(limitCount)) parts.push(limit(limitCount))
    const q = query(...parts)
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        onNext(rows)
      },
      (e) => onError?.(e)
    )
  }

  subscribeById({ reservationId, onNext, onError }) {
    if (!reservationId) throw new Error('No reservation found.')
    const ref = doc(this.db, 'reservations', reservationId)
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          onNext(null)
          return
        }
        onNext({ id: snap.id, ...snap.data() })
      },
      (e) => onError?.(e)
    )
  }

  subscribeByUserId({ userId, onNext, onError }) {
    if (!userId) throw new Error('Missing userId')
    const q = query(collection(this.db, 'reservations'), where('userId', '==', userId))
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        onNext(rows)
      },
      (e) => onError?.(e)
    )
  }

  async setStatus({ reservationId, status, extraUpdates }) {
    if (!reservationId) throw new Error('No reservation found.')
    await updateDoc(doc(this.db, 'reservations', reservationId), {
      status,
      ...(extraUpdates || {}),
      updatedAt: serverTimestamp(),
    })
  }

  async cancelReservation({ reservationId, tableId, slotKeys }) {
    if (!reservationId) throw new Error('No reservation found.')

    const batch = writeBatch(this.db)

    if (tableId && Array.isArray(slotKeys)) {
      for (const key of slotKeys) {
        const slotRef = doc(this.db, 'tables', tableId, 'slots', key)
        batch.delete(slotRef)
      }
    }

    const resRef = doc(this.db, 'reservations', reservationId)
    batch.update(resRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    await batch.commit()
  }

  async createHoldReservation({
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
    if (!table?.id) throw new Error('Please select a table')

    const name = String(customerName || '').trim()
    const phone = String(customerPhone || '').trim()
    const email = String(customerEmail || '').trim()
    if (!phone) throw new Error('Please enter your phone number')

    const dur = Number(durationMinutes)
    if (!Number.isFinite(dur) || dur <= 0) throw new Error('Invalid duration')
    if (dur % TIMELINE_CONFIG.stepMinutes !== 0) throw new Error('Duration must be in 30-minute blocks')
    if (dur > TIMELINE_CONFIG.maxDurationMinutes) throw new Error('Duration exceeds max (6h)')

    const startTime = buildDateFromISOAndMinutes(isoDate, Number(startMinutes))
    const endTime = new Date(startTime.getTime() + dur * 60 * 1000)
    if (Number.isNaN(startTime.getTime())) throw new Error('Invalid start time')
    if (endTime <= startTime) throw new Error('Invalid time range')

    const holdExpiresAt = startTime
    const reservationRef = doc(collection(this.db, 'reservations'))
    const slotKeys = buildSlotKeys({
      startAt: startTime,
      durationMinutes: dur,
      stepMinutes: TIMELINE_CONFIG.stepMinutes,
    })

    await runTransaction(this.db, async (tx) => {
      const slotRefs = slotKeys.map((key) => doc(this.db, 'tables', table.id, 'slots', key))

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
          status: 'hold',
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
        tableSeats: Number(table.seats) || null,
        partySize: Number(partySize) || null,
        startTime,
        endTime,
        durationMinutes: dur,
        status: 'hold',
        holdExpiresAt,
        slotKeys,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })

    return reservationRef.id
  }

  async cancelFutureReservation({ reservation }) {
    if (!reservation?.id) throw new Error('Missing reservation')

    const start = reservation.startTime?.toDate?.() || new Date(reservation.startTime)
    if (start && start <= new Date()) throw new Error('Cannot cancel past reservations')

    await this.setStatus({
      reservationId: reservation.id,
      status: 'cancelled',
      extraUpdates: { cancelledAt: serverTimestamp() },
    })

    // Release slots (best-effort)
    const tableId = reservation.tableId
    const slotKeys = Array.isArray(reservation.slotKeys) ? reservation.slotKeys : []
    if (tableId && slotKeys.length > 0) {
      const batch = writeBatch(this.db)
      for (const key of slotKeys) {
        batch.delete(doc(this.db, 'tables', tableId, 'slots', key))
      }
      await batch.commit()
    }
  }
}
