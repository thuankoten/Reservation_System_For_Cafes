import { useEffect, useMemo, useState } from 'react'
import { signOut } from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '../../../shared/firebase'
import { useAuth } from '../../auth/AuthContext'

function toISODateTimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function CustomerDashboard() {
  const { user } = useAuth()
  const [tables, setTables] = useState([])
  const [myReservations, setMyReservations] = useState([])

  const [selectedTableId, setSelectedTableId] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [startTimeLocal, setStartTimeLocal] = useState(() => toISODateTimeLocalValue(new Date(Date.now() + 30 * 60 * 1000)))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const qTables = query(collection(db, 'tables'), orderBy('number', 'asc'))
    const unsub = onSnapshot(
      qTables,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setTables(rows)
        if (!selectedTableId) {
          const firstAvailable = rows.find((t) => (t.status || 'available') === 'available')
          if (firstAvailable) setSelectedTableId(firstAvailable.id)
        }
      },
      (e) => setError(e?.message || 'Failed to load tables')
    )

    return () => unsub()
  }, [selectedTableId])

  useEffect(() => {
    if (!user?.uid) return

    const qMine = query(
      collection(db, 'reservations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )

    const unsub = onSnapshot(
      qMine,
      (snap) => setMyReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setError(e?.message || 'Failed to load reservations')
    )

    return () => unsub()
  }, [user?.uid])

  const availableTables = useMemo(
    () => tables.filter((t) => (t.status || 'available') === 'available'),
    [tables]
  )

  async function createReservation() {
    setError('')
    if (!selectedTableId) {
      setError('Please select a table')
      return
    }
    if (!user?.uid) {
      setError('Not authenticated')
      return
    }

    setSubmitting(true)
    try {
      const startTime = new Date(startTimeLocal)

      await addDoc(collection(db, 'reservations'), {
        userId: user.uid,
        userEmail: user.email || null,
        tableId: selectedTableId,
        partySize: Number(partySize),
        startTime,
        status: 'active',
        createdAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'tables', selectedTableId), {
        status: 'reserved',
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      setError(e?.message || 'Failed to create reservation')
    } finally {
      setSubmitting(false)
    }
  }

  async function cancelReservation(reservationId, tableId) {
    setError('')
    try {
      await updateDoc(doc(db, 'reservations', reservationId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
      })

      if (tableId) {
        await updateDoc(doc(db, 'tables', tableId), {
          status: 'available',
          updatedAt: serverTimestamp(),
        })
      }
    } catch (e) {
      setError(e?.message || 'Failed to cancel reservation')
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Customer Dashboard</h2>
          <div style={{ opacity: 0.75 }}>{user?.email}</div>
        </div>
        <button onClick={() => signOut(auth)} style={{ padding: 10 }}>
          Logout
        </button>
      </header>

      <section style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Create Reservation</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            Table
            <select value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)} style={{ padding: 10 }}>
              <option value="" disabled>
                Select a table
              </option>
              {availableTables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number} (seats: {t.seats || '?'})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            Party size
            <input
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              type="number"
              min={1}
              style={{ padding: 10 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            Time
            <input
              value={startTimeLocal}
              onChange={(e) => setStartTimeLocal(e.target.value)}
              type="datetime-local"
              style={{ padding: 10 }}
            />
          </label>

          <div style={{ display: 'grid', alignContent: 'end' }}>
            <button disabled={submitting} onClick={createReservation} style={{ padding: 10 }}>
              {submitting ? 'Creating...' : 'Reserve'}
            </button>
          </div>
        </div>

        {error ? <div style={{ marginTop: 12, color: '#b91c1c' }}>{error}</div> : null}
      </section>

      <section style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Tables (realtime)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {tables.map((t) => (
            <div key={t.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 600 }}>Table {t.number}</div>
              <div>Seats: {t.seats || '?'}</div>
              <div>Status: {t.status || 'available'}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>My reservations (realtime)</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {myReservations.length === 0 ? <div style={{ opacity: 0.75 }}>No reservations yet.</div> : null}
          {myReservations.map((r) => (
            <div
              key={r.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 12,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>Table: {r.tableId}</div>
                <div>Party size: {r.partySize}</div>
                <div>Status: {r.status}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {r.status === 'active' ? (
                  <button onClick={() => cancelReservation(r.id, r.tableId)} style={{ padding: 10 }}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
