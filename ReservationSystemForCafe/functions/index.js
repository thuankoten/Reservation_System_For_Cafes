const functions = require('firebase-functions')
const admin = require('firebase-admin')

// Initialize Admin SDK
try {
  admin.initializeApp()
} catch (e) {
  // ignore if already initialized
}

const db = admin.firestore()

async function expireOverdue({ now = Date.now() }) {
  const startCutoffMs = now - 30 * 60 * 1000
  const confirmedSnap = await db.collection('reservations').where('status', '==', 'confirmed').get()
  const holdsSnap = await db.collection('reservations').where('status', '==', 'hold').get()
  if (confirmedSnap.empty && holdsSnap.empty) return { expiredCount: 0 }

  const batch = db.batch()
  let expiredCount = 0

  confirmedSnap.forEach((docSnap) => {
    const r = docSnap.data()
    const id = docSnap.id

    const toDate = (v) => {
      if (!v) return null
      if (typeof v.toDate === 'function') return v.toDate()
      try { return new Date(v) } catch { return null }
    }

    const start = toDate(r.startTime)
    const end = toDate(r.endTime)
    const checkedInAt = toDate(r.checkedInAt)

    // Skip if already checked in
    if (checkedInAt) return

    const startExpired = start instanceof Date && start.getTime() < startCutoffMs
    const endPassed = end instanceof Date && end.getTime() < now

    if (startExpired || endPassed) {
      batch.update(db.collection('reservations').doc(id), {
        status: 'expired',
        expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      if (r.tableId) {
        batch.update(db.collection('tables').doc(r.tableId), {
          status: 'available',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      }
      expiredCount += 1
    }
  })

  holdsSnap.forEach((docSnap) => {
    const r = docSnap.data()
    const id = docSnap.id
    const toDate = (v) => {
      if (!v) return null
      if (typeof v.toDate === 'function') return v.toDate()
      try { return new Date(v) } catch { return null }
    }
    const holdExpiresAt = toDate(r.holdExpiresAt)
    if (holdExpiresAt && holdExpiresAt.getTime() < now) {
      batch.update(db.collection('reservations').doc(id), {
        status: 'expired',
        expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      expiredCount += 1
    }
  })

  if (expiredCount > 0) await batch.commit()
  return { expiredCount }
}

exports.expireOverdueReservations = functions.pubsub
  .schedule('every 5 minutes')
  .timeZone('Asia/Ho_Chi_Minh')
  .onRun(async () => {
    const now = Date.now()
    const { expiredCount } = await expireOverdue({ now })
    console.log(`Expired overdue reservations: ${expiredCount}`)

    // Reconcile table statuses to ensure no stale 'reserved' when everything is expired/cancelled
    try {
      const tablesSnap = await db.collection('tables').get()
      const batch = db.batch()

      for (const tableDoc of tablesSnap.docs) {
        const tableId = tableDoc.id
        const tData = tableDoc.data() || {}

        // Fetch confirmed reservations for this table
          const resSnap = await db
            .collection('reservations')
            .where('tableId', '==', tableId)
            .where('status', 'in', ['confirmed','occupied'])
            .get()

        const toDate = (v) => {
          if (!v) return null
          if (typeof v.toDate === 'function') return v.toDate()
          try { return new Date(v) } catch { return null }
        }

        let hasDining = false
        let hasUpcomingOrCurrent = false

        resSnap.forEach((docSnap) => {
          const r = docSnap.data()
          const start = toDate(r.startTime)
          const end = toDate(r.endTime)
          const checkedInAt = toDate(r.checkedInAt)
          const checkedOutAt = toDate(r.checkedOutAt)

          if (checkedInAt && !checkedOutAt) {
            hasDining = true
            return
          }

          // consider reservation still relevant if end is in the future (or absent and start future)
          const endTime = end ? end.getTime?.() : null
          const startTime = start ? start.getTime?.() : null
          if ((endTime && endTime >= now) || (!endTime && startTime && startTime >= now)) {
            hasUpcomingOrCurrent = true
          }
        })

        const currentStatus = String(tData.status || '').toLowerCase()
        let desired = currentStatus
        if (hasDining) desired = 'occupied'
        else if (hasUpcomingOrCurrent) desired = 'reserved'
        else desired = 'available'

        if (desired !== currentStatus) {
          batch.update(db.collection('tables').doc(tableId), {
            status: desired,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }
      }

      await batch.commit()
      console.log('Reconciled table statuses')
    } catch (e) {
      console.error('Failed to reconcile table statuses', e)
    }

    return null
  })
