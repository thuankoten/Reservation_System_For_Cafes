import { useEffect, useMemo, useState } from 'react'
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
import { db } from '../../../shared/firebase'
import { useAuth } from '../../auth/AuthContext.jsx'

function toISODateTimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function ReservationPage() {
  const { user } = useAuth()
  const [tables, setTables] = useState([])
  const [myReservations, setMyReservations] = useState([])

  const [selectedTableId, setSelectedTableId] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [startTimeLocal, setStartTimeLocal] = useState(() =>
    toISODateTimeLocalValue(new Date(Date.now() + 30 * 60 * 1000))
  )
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
      setError('Please sign in to create a reservation')
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
    <div className="stack">
      <div className="card">
        <h2 className="pageTitle">Reservation</h2>
        <div className="muted">Create and manage your reservations (realtime)</div>

        {!user ? (
          <div className="muted" style={{ marginTop: 10 }}>
            Browsing as guest. You can view availability, but reservation actions are disabled.
          </div>
        ) : null}

        <div className="formGrid" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field__label">Table</div>
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="input"
              disabled={!user}
            >
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

          <label className="field">
            <div className="field__label">Party size</div>
            <input
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              type="number"
              min={1}
              className="input"
              disabled={!user}
            />
          </label>

          <label className="field">
            <div className="field__label">Time</div>
            <input
              value={startTimeLocal}
              onChange={(e) => setStartTimeLocal(e.target.value)}
              type="datetime-local"
              className="input"
              disabled={!user}
            />
          </label>

          <div className="field" style={{ alignSelf: 'end' }}>
            <button disabled={submitting || !user} onClick={createReservation} className="btn btn--primary">
              {submitting ? 'Creating...' : 'Reserve'}
            </button>
          </div>
        </div>

        {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>My reservations</h3>
        <div className="stack">
          {!user ? <div className="muted">Sign in to see your reservations.</div> : null}
          {user && myReservations.length === 0 ? <div className="muted">No reservations yet.</div> : null}
          {myReservations.map((r) => (
            <div key={r.id} className="rowCard">
              <div>
                <div className="rowCard__title">Table: {r.tableId}</div>
                <div className="muted">Party size: {r.partySize}</div>
                <div className="muted">Status: {r.status}</div>
              </div>
              <div>
                {r.status === 'active' ? (
                  <button onClick={() => cancelReservation(r.id, r.tableId)} className="btn">
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
