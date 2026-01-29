// Re-export admin-specific reservation operations
export {
  approveReservation,
  rejectReservation,
  checkInReservation,
  checkOutTable,
  expireOverdueConfirmed,
  reconcileTableStatuses,
  occupyTableManual,
  releaseTableManual,
} from '../customer/reservations'

import {
  approveReservation as approveReservationFn,
  rejectReservation as rejectReservationFn,
  checkInReservation as checkInReservationFn,
  checkOutTable as checkOutTableFn,
  expireOverdueConfirmed as expireOverdueConfirmedFn,
  reconcileTableStatuses as reconcileTableStatusesFn,
  occupyTableManual as occupyTableManualFn,
  releaseTableManual as releaseTableManualFn,
} from '../customer/reservations'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'

/**
 * Admin wrapper: Approve a reservation (transition hold → confirmed)
 */
export async function approveReservationAction({ db, reservation }) {
  return approveReservationFn({ db, reservation })
}

/**
 * Admin wrapper: Reject a reservation (transition hold → rejected)
 */
export async function rejectReservationAction({ db, reservation }) {
  return rejectReservationFn({ db, reservation })
}

/**
 * Admin wrapper: Cancel a confirmed/hold reservation
 */
export async function cancelReservation({ db, reservation }) {
  const start = reservation.startTime?.toDate?.() || new Date(reservation.startTime)
  if (start && start <= new Date()) throw new Error('Cannot cancel past reservations')

  await updateDoc(doc(db, 'reservations', reservation.id), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  })

  await updateDoc(doc(db, 'tables', reservation.tableId), {
    status: 'available',
    updatedAt: serverTimestamp(),
  })
}

/**
 * Admin wrapper: Check in a confirmed reservation
 */
export async function checkInReservationAction({ db, reservationId, tableId }) {
  return checkInReservationFn({ db, reservationId, tableId })
}

/**
 * Admin wrapper: Check out and complete a reservation or walk-in
 */
export async function checkOutTableAction({ db, tableId, reservationId, keepReserved }) {
  return checkOutTableFn({ db, tableId, reservationId, keepReserved })
}

/**
 * Admin wrapper: Manual check-in for walk-in customer
 */
export async function manualCheckInAction({ db, tableId }) {
  return occupyTableManualFn({ db, tableId })
}

/**
 * Admin wrapper: Manual check-out for walk-in customer
 */
export async function manualCheckOutAction({ db, tableId, keepReserved }) {
  return releaseTableManualFn({ db, tableId, keepReserved })
}

/**
 * Admin wrapper: Expire overdue confirmed reservations
 */
export async function expireOverdueAction({ db, reservations }) {
  return expireOverdueConfirmedFn({ db, reservations })
}

/**
 * Admin wrapper: Reconcile table statuses with reservations
 */
export async function reconcileTableStatusesAction({ db, tables, reservations }) {
  return reconcileTableStatusesFn({ db, tables, reservations })
}
