import {
	collection,
	deleteField,
	deleteDoc,
	doc,
	getDocs,
	query,
	runTransaction,
	serverTimestamp,
	updateDoc,
	where,
	writeBatch,
} from 'firebase/firestore'

import { buildDateFromISOAndMinutes, TIMELINE_CONFIG } from '../utils/timeline'
import { buildSlotKeys, addMinutes } from '../utils/slotKeys'

// ===== Shared constants/utilities =====
export const RESERVATION_STATUS = {
	HOLD: 'hold',
	CONFIRMED: 'confirmed',
	CANCELLED: 'cancelled',
	EXPIRED: 'expired',
	OCCUPIED: 'occupied',
	COMPLETED: 'completed',
}

export function computeReservationTimes({ isoDate, startMinutes, durationMinutes }) {
	const startTime = buildDateFromISOAndMinutes(isoDate, startMinutes)
	const endTime = addMinutes(startTime, Number(durationMinutes) || 0)
	return { startTime, endTime }
}

// ===== Customer-facing operations =====
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

// ===== Admin-facing operations =====
export async function approveReservation({ db, reservation }) {
	if (!reservation?.id) throw new Error('Missing reservation')
	const resRef = doc(db, 'reservations', reservation.id)
	await updateDoc(resRef, {
		status: RESERVATION_STATUS.CONFIRMED,
		confirmedAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	})
	if (reservation.tableId) {
		await updateDoc(doc(db, 'tables', reservation.tableId), {
			status: 'reserved',
			updatedAt: serverTimestamp(),
		})
	}
}

export async function rejectReservation({ db, reservation }) {
	if (!reservation?.id) throw new Error('Missing reservation')
	const resRef = doc(db, 'reservations', reservation.id)
	await updateDoc(resRef, {
		status: 'rejected',
		rejectedAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	})
	if (reservation.tableId) {
		await updateDoc(doc(db, 'tables', reservation.tableId), {
			status: 'available',
			updatedAt: serverTimestamp(),
		})
	}
}

export async function checkInReservation({ db, reservationId, tableId }) {
	if (!reservationId || !tableId) throw new Error('Missing reservationId/tableId')
	await updateDoc(doc(db, 'reservations', reservationId), {
		status: RESERVATION_STATUS.OCCUPIED,
		checkedInAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	})
	await updateDoc(doc(db, 'tables', tableId), {
		status: 'occupied',
		updatedAt: serverTimestamp(),
	})
}

export async function checkOutTable({ db, tableId, reservationId, keepReserved }) {
	if (!tableId) throw new Error('Missing tableId')
	if (reservationId) {
		await updateDoc(doc(db, 'reservations', reservationId), {
			status: RESERVATION_STATUS.COMPLETED,
			checkedOutAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
		})
	}
	await updateDoc(doc(db, 'tables', tableId), {
		status: keepReserved ? 'reserved' : 'available',
		updatedAt: serverTimestamp(),
	})
}

// Expire confirmed reservations 30 minutes past start if not checked in
export async function expireOverdueConfirmed({ db, reservations }) {
	const nowMs = Date.now()
	const startCutoffMs = nowMs - 30 * 60 * 1000
	const confirmedToExpire = (reservations || []).filter((r) => {
		const s = String(r.status || '').toLowerCase()
		if (s !== 'confirmed') return false
		if (r.checkedInAt) return false
		const start = typeof r.startTime?.toDate === 'function' ? r.startTime.toDate() : r.startTime
		const end = typeof r.endTime?.toDate === 'function' ? r.endTime.toDate() : r.endTime
		const startOk = start instanceof Date && start.getTime() < startCutoffMs
		const endPassed = end instanceof Date && end.getTime() < nowMs
		return Boolean(startOk || endPassed)
	})
	const holdsToExpire = (reservations || []).filter((r) => {
		const s = String(r.status || '').toLowerCase()
		if (s !== 'hold') return false
		const hold = typeof r.holdExpiresAt?.toDate === 'function' ? r.holdExpiresAt.toDate() : r.holdExpiresAt
		return hold instanceof Date && hold.getTime() < nowMs
	})
	if (confirmedToExpire.length === 0 && holdsToExpire.length === 0) return
	const batch = writeBatch(db)
	for (const r of confirmedToExpire) {
		batch.update(doc(db, 'reservations', r.id), {
			status: RESERVATION_STATUS.EXPIRED,
			expiredAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
		})
		if (r.tableId) {
			batch.update(doc(db, 'tables', r.tableId), {
				status: 'available',
				updatedAt: serverTimestamp(),
			})
		}
	}
	for (const r of holdsToExpire) {
		batch.update(doc(db, 'reservations', r.id), {
			status: RESERVATION_STATUS.EXPIRED,
			expiredAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
		})
	}
	await batch.commit()
}

// Reconcile table statuses client-side (admin) for immediate correction
// desired logic: occupied > reserved > available
export async function reconcileTableStatuses({ db, tables, reservations }) {
	if (!Array.isArray(tables) || tables.length === 0) return
	const now = Date.now()

	const batch = writeBatch(db)
	let changed = 0

	const toDate = (v) => {
		if (!v) return null
		if (typeof v?.toDate === 'function') return v.toDate()
		try { return new Date(v) } catch { return null }
	}

	for (const t of tables) {
		const tableId = t.id
		if (!tableId) continue
		const currentStatus = String(t.status || '').toLowerCase()

		let relevant = []
		if (Array.isArray(reservations) && reservations.length > 0) {
			relevant = reservations.filter((r) => r.tableId === tableId && ['confirmed','occupied'].includes(String(r.status || '').toLowerCase()))
		} else {
			const snap = await getDocs(
				query(
					collection(db, 'reservations'),
					where('tableId', '==', tableId),
					where('status', 'in', ['confirmed','occupied'])
				)
			)
			relevant = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
		}

		// Respect active manual (walk-in) occupancy first
		const mos = toDate(t.manualOccupiedSince)
		const mou = toDate(t.manualOccupiedUntil)
		const isManualActive = !!(mos && !mou)

		let hasDining = false
		let hasUpcomingOrCurrent = false

		for (const r of relevant) {
			const start = toDate(r.startTime)
			const end = toDate(r.endTime)
			const cin = toDate(r.checkedInAt)
			const cout = toDate(r.checkedOutAt)
			if (cin && !cout) { hasDining = true; break }
			const endMs = end ? end.getTime?.() : null
			const startMs = start ? start.getTime?.() : null
			if ((endMs && endMs >= now) || (!endMs && startMs && startMs >= now)) {
				hasUpcomingOrCurrent = true
			}
		}

		let desired = currentStatus
		if (isManualActive) desired = 'occupied'
		else if (hasDining) desired = 'occupied'
		else if (hasUpcomingOrCurrent) desired = 'reserved'
		else desired = 'available'

		if (desired !== currentStatus) {
			batch.update(doc(db, 'tables', tableId), { status: desired, updatedAt: serverTimestamp() })
			changed += 1
		}
	}

	if (changed > 0) await batch.commit()
}

// ===== Manual occupancy (walk-in) operations =====
export async function occupyTableManual({ db, tableId, note }) {
	if (!tableId) throw new Error('Missing tableId')
	await updateDoc(doc(db, 'tables', tableId), {
		status: 'occupied',
		manualOccupiedSince: serverTimestamp(),
		manualOccupiedNote: note || null,
		updatedAt: serverTimestamp(),
	})
}

export async function releaseTableManual({ db, tableId, keepReserved }) {
	if (!tableId) throw new Error('Missing tableId')
	await updateDoc(doc(db, 'tables', tableId), {
		status: keepReserved ? 'reserved' : 'available',
		manualOccupiedUntil: serverTimestamp(),
		manualOccupiedSince: deleteField(),
		manualOccupiedNote: deleteField(),
		updatedAt: serverTimestamp(),
	})
}

// Backwards compatibility: export everything the old modules provided
export default {
	RESERVATION_STATUS,
	computeReservationTimes,
	createHoldReservation,
	cancelReservation,
	confirmHoldReservation,
	expireReservation,
	deleteReservationDoc,
	approveReservation,
	rejectReservation,
	checkInReservation,
	checkOutTable,
	expireOverdueConfirmed,
	reconcileTableStatuses,
	occupyTableManual,
	releaseTableManual,
}
