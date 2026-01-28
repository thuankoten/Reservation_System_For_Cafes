import {
  collection,
  onSnapshot,
  query,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../../../shared/firebase'
import ReservationRow from '../components/ReservationRow'
import ReservationFilter from '../components/ReservationFilter'

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
  const yesterday = []
  const older = []

  filtered.forEach(r => {
    const start = toDate(r.startTime)

    if (r.status === 'hold') {
      waiting.push(r)
      return
    }

    if (start && isSameDay(start, now)) {
      today.push(r)
    } else if (
      start &&
      isSameDay(start, yesterdayDate)
    ) {
      yesterday.push(r)
    } else {
      older.push(r)
    }
  })

  /** ===== ACTIONS ===== */
  async function confirm(r) {
    await updateDoc(
      doc(db, 'reservations', r.id),
      {
        status: 'confirmed',
        updatedAt: serverTimestamp(),
      }
    )

    await updateDoc(
      doc(db, 'tables', r.tableId),
      {
        status: 'reserved',
        updatedAt: serverTimestamp(),
      }
    )
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
    await updateDoc(
      doc(db, 'reservations', r.id),
      {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      }
    )
  }

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
        title="⏳ Waiting for approval"
        data={waiting}
        onConfirm={confirm}
        onReject={reject}
      />

      <Section
        title="🟢 Reservations today"
        data={today}
        onCancel={cancel}
      />

      <Section
        title="🟡 Yesterday"
        data={yesterday}
      />

      <Section
        title="📜 Older reservations"
        data={older}
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
  