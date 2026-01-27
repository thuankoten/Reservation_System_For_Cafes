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

export default function AdminReservationPage() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('all') // ✅ FIX: mặc định ALL

  useEffect(() => {
    const q = query(collection(db, 'reservations'))

    return onSnapshot(q, snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  /** ================= FILTER ================= */
  const filtered = useMemo(() => {
    if (filter === 'all') return rows // ✅ ALL bao gồm HOLD

    return rows.filter(r => {
      if (filter === 'confirmed') return r.status === 'confirmed'
      if (filter === 'expired') return r.status === 'expired'
      return r.status === filter
    })
  }, [rows, filter])

  /** ================= SPLIT TODAY / HISTORY ================= */
  const todayStr = new Date().toDateString()

  const pendingToday = useMemo(
    () =>
      filtered.filter(r => {
        if (r.status !== 'hold') return false
        const created = toDate(r.createdAt)
        return created?.toDateString() === todayStr
      }),
    [filtered, todayStr]
  )

  const history = useMemo(
    () =>
      filtered.filter(r => {
        const created = toDate(r.createdAt)
        if (!created) return true
        return (
          r.status !== 'hold' ||
          created.toDateString() !== todayStr
        )
      }),
    [filtered, todayStr]
  )

  /** ================= ACTIONS ================= */
  async function approve(r) {
    await updateDoc(doc(db, 'reservations', r.id), {
      status: 'confirmed',
      updatedAt: serverTimestamp(),
    })

    await updateDoc(doc(db, 'tables', r.tableId), {
      status: 'occupied',
      updatedAt: serverTimestamp(),
    })
  }

  async function reject(r) {
    await updateDoc(doc(db, 'reservations', r.id), {
      status: 'rejected',
      updatedAt: serverTimestamp(),
    })

    await updateDoc(doc(db, 'tables', r.tableId), {
      status: 'available',
      updatedAt: serverTimestamp(),
    })
  }

  /** ================= UI ================= */
  return (
    <div className="stack">
      <h2 className="pageTitle">Admin • Reservations</h2>

      <ReservationFilter value={filter} onChange={setFilter} />

      {/* ===== TODAY ===== */}
      <h3 style={{ marginTop: 16 }}>
        ⏳ Reservations waiting for approval (Today)
      </h3>

      {pendingToday.length === 0 && (
        <div className="muted">No reservations to approve today</div>
      )}

      {pendingToday.map(r => (
        <ReservationRow
          key={r.id}
          r={r}
          onApprove={approve}
          onReject={reject}
        />
      ))}

      <hr style={{ margin: '24px 0', opacity: 0.25 }} />

      {/* ===== HISTORY ===== */}
      <h3>📜 Previous reservations</h3>

      {history.length === 0 && (
        <div className="muted">No previous reservations</div>
      )}

      {history.map(r => (
        <ReservationRow key={r.id} r={r} />
      ))}
    </div>
  )
}
