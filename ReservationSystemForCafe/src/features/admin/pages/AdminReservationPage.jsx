import { collection, onSnapshot, query, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../../../shared/firebase'
import ReservationRow from '../components/ReservationRow'
import ReservationFilter from '../components/ReservationFilter'
import { approveReservation, rejectReservation, expireOverdueConfirmed as adminExpireOverdue } from '../../../shared/services/admin/reservations'

function toDate(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  return new Date(v)
}

function isSameDay(a, b) {
  return (
    a &&
    b &&
    a.toDateString() === b.toDateString()
  )
}

export default function AdminReservationPage() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('all')
  const [keyword, setKeyword] = useState('')

  /** ===== LOAD DATA ===== */
  useEffect(() => {
    const q = query(collection(db, 'reservations'))
    return onSnapshot(q, snap => {
      setRows(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }))
      )
    })
  }, [])

  // Auto-expire moved to AdminTablesPage and Cloud Function.
  // Also run here to reflect status immediately on this page.
  useEffect(() => {
    let timerId
    async function runExpire() {
      try {
        await adminExpireOverdue({ db, reservations: rows })
      } catch (e) {
        // ignore errors here to avoid noisy UI
      }
    }
    runExpire()
    timerId = setInterval(runExpire, 5 * 60 * 1000)
    return () => timerId && clearInterval(timerId)
  }, [rows])

  /** ===== SEARCH ===== */
  const searched = useMemo(() => {
    if (!keyword.trim()) return rows
    const k = keyword.toLowerCase()

    return rows.filter(r =>
      [
        r.customerName,
        r.userEmail,
        r.tableNumber,
      ]
        .filter(Boolean)
        .some(v =>
          String(v).toLowerCase().includes(k)
        )
    )
  }, [rows, keyword])

  /** ===== FILTER STATUS ===== */
  const filtered = useMemo(() => {
    if (filter === 'all') return searched
    return searched.filter(
      r => r.status === filter
    )
  }, [searched, filter])

  /** ===== GROUP BY TIME ===== */
  const now = new Date()
  const yesterdayDate = new Date()
  yesterdayDate.setDate(
    yesterdayDate.getDate() - 1
  )

  const waiting = []
  const today = []
  const upcoming = []
  const yesterday = []
  const older = []

  filtered.forEach((r) => {
    const start = toDate(r.startTime)
    if (r.status === 'hold') {
      waiting.push(r)
      return
    }
    if (start && isSameDay(start, now)) {
      today.push(r)
      return
    }
    if (start && start > now) {
      upcoming.push(r)
      return
    }
    if (start && isSameDay(start, yesterdayDate)) {
      yesterday.push(r)
      return
    }
    older.push(r)
  })

  // Sort today's list: active first, then overdue/done/expired/cancelled
  const todaySorted = today.slice().sort((a, b) => {
    const toDateSafe = (v) => (typeof v?.toDate === 'function' ? v.toDate() : v ? new Date(v) : null)
    const now = new Date()
    const startA = toDateSafe(a.startTime); const endA = toDateSafe(a.endTime)
    const startB = toDateSafe(b.startTime); const endB = toDateSafe(b.endTime)
    const checkedInA = Boolean(toDateSafe(a.checkedInAt)); const checkedOutA = Boolean(toDateSafe(a.checkedOutAt))
    const checkedInB = Boolean(toDateSafe(b.checkedInAt)); const checkedOutB = Boolean(toDateSafe(b.checkedOutAt))
    const statusA = String(a.status || '').toLowerCase()
    const statusB = String(b.status || '').toLowerCase()
    const overdueA = (!checkedInA && ( (startA && startA.getTime() < now.getTime() - 30*60*1000) || (endA && endA < now) ))
    const overdueB = (!checkedInB && ( (startB && startB.getTime() < now.getTime() - 30*60*1000) || (endB && endB < now) ))
    const isActiveA = statusA !== 'cancelled' && statusA !== 'expired' && !checkedOutA && !overdueA
    const isActiveB = statusB !== 'cancelled' && statusB !== 'expired' && !checkedOutB && !overdueB
    if (isActiveA !== isActiveB) return isActiveA ? -1 : 1
    // Within same bucket, sort by start time ascending
    const tA = startA?.getTime?.() || 0
    const tB = startB?.getTime?.() || 0
    return tA - tB
  })

  const sortByStartAsc = (list) => list.slice().sort((a, b) => {
    const ta = toDate(a.startTime)?.getTime?.() || 0
    const tb = toDate(b.startTime)?.getTime?.() || 0
    return ta - tb
  })
  const upcomingSorted = sortByStartAsc(upcoming)
  const yesterdaySorted = sortByStartAsc(yesterday)
  const olderSorted = sortByStartAsc(older)

  /** ===== ACTIONS ===== */
  async function confirm(r) {
    await approveReservation({ db, reservation: r })
  }

  async function cancel(r) {
    const start = toDate(r.startTime)
    if (start && start <= new Date()) return

    await updateDoc(
      doc(db, 'reservations', r.id),
      {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      }
    )

    await updateDoc(
      doc(db, 'tables', r.tableId),
      {
        status: 'available',
        updatedAt: serverTimestamp(),
      }
    )
  }

  async function reject(r) {
    await rejectReservation({ db, reservation: r })
  }

  // Expiration handled automatically via AdminTablesPage and Cloud Function.

  /** ===== UI ===== */
  return (
    <div className="stack">
      <h2 className="pageTitle">
        Admin • Reservations
      </h2>

      <ReservationFilter
        value={filter}
        onChange={setFilter}
        keyword={keyword}
        onKeywordChange={setKeyword}
      />

      <Section
        title="Waiting for approval"
        data={waiting}
        onConfirm={confirm}
        onReject={reject}
      />

      <Section
        title="Reservations today"
          data={todaySorted}
        onCancel={cancel}
      />

      <Section
        title="Reservations next days"
        data={upcomingSorted}
        onCancel={cancel}
      />

      <Section
        title="Yesterday"
        data={yesterdaySorted}
      />

      <Section
        title="Older reservations"
        data={olderSorted}
      />
    </div>
  )
}

/** ===== SECTION ===== */
function Section({ title, data, ...actions }) {
  return (
    <>
      <h3 style={{ marginTop: 24 }}>
        {title}
      </h3>

      {data.length === 0 && (
        <div className="muted">
          No reservations
        </div>
      )}

      {data.map(r => (
        <ReservationRow
          key={r.id}
          r={r}
          {...actions}
        />
      ))}

      <hr
        style={{
          margin: '24px 0',
          opacity: 0.2,
        }}
      />
    </>
  )
}
  