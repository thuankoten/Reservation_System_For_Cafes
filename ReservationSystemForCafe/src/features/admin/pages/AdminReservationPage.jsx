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

export default function AdminReservationPage() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('hold')

  useEffect(() => {
    const q = query(collection(db, 'reservations'))

    return onSnapshot(q, snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

const filtered = useMemo(() => {
  if (filter === 'all') return rows

  return rows.filter(r => {
    // approved không lọc riêng
    if (filter === 'confirmed') {
      return r.status === 'confirmed'
    }

    if (filter === 'expired') {
      return r.status === 'expired'
    }

    return r.status === filter
  })
}, [rows, filter])


  async function approve(r) {
    await updateDoc(doc(db, 'reservations', r.id), {
      status: 'approved',
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

  return (
    <div className="stack">
      <h2 className="pageTitle">Admin • Reservations</h2>

      <ReservationFilter value={filter} onChange={setFilter} />

      {filtered.length === 0 && (
        <div className="muted">No reservations</div>
      )}

      {filtered.map(r => (
        <ReservationRow
          key={r.id}
          r={r}
          onApprove={approve}
          onReject={reject}
        />
      ))}
    </div>
  )
}
