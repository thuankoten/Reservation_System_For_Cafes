import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../../shared/firebase'
import { useAuth } from '../../auth/AuthContext.jsx'

function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

function formatWhen(date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return String(date)
  }
}

function minutesFromNow(date) {
  const diffMs = date.getTime() - Date.now()
  const mins = Math.round(diffMs / 60000)
  return mins
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [availableCount, setAvailableCount] = useState(null)
  const [totalCount, setTotalCount] = useState(null)
  const [currentReservation, setCurrentReservation] = useState(null)
  const [loadingReservation, setLoadingReservation] = useState(true)
  const [loadingTables, setLoadingTables] = useState(true)
  const [error, setError] = useState('')

  const [partySize, setPartySize] = useState(2)
  const [timeLocal, setTimeLocal] = useState(() => {
    const d = new Date(Date.now() + 30 * 60 * 1000)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })

  useEffect(() => {
    setError('')
    setLoadingTables(true)

    const qTables = query(collection(db, 'tables'), orderBy('number', 'asc'))
    const unsub = onSnapshot(
      qTables,
      (snap) => {
        const rows = snap.docs.map((d) => d.data())
        const available = rows.filter((t) => (t.status || 'available') === 'available').length
        setAvailableCount(available)
        setTotalCount(rows.length)
        setLoadingTables(false)
      },
      (e) => {
        setError(e?.message || 'Failed to load tables')
        setLoadingTables(false)
      }
    )

    return () => unsub()
  }, [])

  useEffect(() => {
    setError('')

    if (!user?.uid) {
      setCurrentReservation(null)
      setLoadingReservation(false)
      return
    }

    setLoadingReservation(true)
    const qActive = query(
      collection(db, 'reservations'),
      where('userId', '==', user.uid),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(1)
    )

    const unsub = onSnapshot(
      qActive,
      (snap) => {
        const doc = snap.docs[0]
        setCurrentReservation(doc ? { id: doc.id, ...doc.data() } : null)
        setLoadingReservation(false)
      },
      (e) => {
        setError(e?.message || 'Failed to load reservation')
        setLoadingReservation(false)
      }
    )

    return () => unsub()
  }, [user?.uid])

  const snapshotText = useMemo(() => {
    if (loadingTables) return 'Loading availability…'
    if (typeof availableCount !== 'number' || typeof totalCount !== 'number') return '—'
    return `${availableCount}/${totalCount} tables available`
  }, [availableCount, loadingTables, totalCount])

  const reservationSummary = useMemo(() => {
    if (!currentReservation) return null
    const start = currentReservation.startTime?.toDate ? currentReservation.startTime.toDate() : new Date(currentReservation.startTime)
    const mins = minutesFromNow(start)
    return {
      start,
      when: formatWhen(start),
      relative: mins >= 0 ? `in ${mins} min` : `${Math.abs(mins)} min ago`,
      tableId: currentReservation.tableId,
      partySize: currentReservation.partySize,
      status: currentReservation.status,
    }
  }, [currentReservation])

  function onQuickBook() {
    navigate('/dashboard/reservation', { replace: false })
  }

  return (
    <div className="stack">
      <div className="overviewGrid">
        <div className="card">
          <div className="cardHeader">
            <div>
              <h2 className="pageTitle">Overview</h2>
              <div className="muted">Today at a glance</div>
            </div>
            <Badge tone="neutral">Customer</Badge>
          </div>

          <div className="split" style={{ marginTop: 12 }}>
            <div>
              <div className="muted">Live availability</div>
              <div className="bigNumber">{loadingTables ? '—' : availableCount ?? '—'}</div>
              <div className="muted">{snapshotText}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
              <Link className="btn" to="/dashboard/floor">
                View floor
              </Link>
              <button className="btn btn--primary" onClick={onQuickBook}>
                Book now
              </button>
            </div>
          </div>

          {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
        </div>

        <div className="card">
          <div className="cardHeader">
            <div style={{ fontWeight: 700 }}>Current reservation</div>
            {user ? <Badge tone="neutral">Signed in</Badge> : <Badge tone="neutral">Guest</Badge>}
          </div>

          {loadingReservation ? (
            <div className="muted" style={{ marginTop: 12 }}>
              Loading…
            </div>
          ) : !user ? (
            <div style={{ marginTop: 12 }}>
              <div className="muted">Login to see and manage your reservation.</div>
              <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link className="btn btn--primary" to="/auth/login">
                  Login
                </Link>
                <Link className="btn" to="/auth/signup">
                  Sign-up
                </Link>
              </div>
            </div>
          ) : !reservationSummary ? (
            <div style={{ marginTop: 12 }}>
              <div className="muted">No active reservation.</div>
              <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn--primary" onClick={onQuickBook}>
                  Create reservation
                </button>
                <Link className="btn" to="/dashboard/reservation">
                  View history
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div className="rowCard" style={{ padding: 12 }}>
                <div>
                  <div className="rowCard__title">Table: {reservationSummary.tableId}</div>
                  <div className="muted">When: {reservationSummary.when}</div>
                  <div className="muted">{reservationSummary.relative} • Party: {reservationSummary.partySize}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Badge tone="success">Active</Badge>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link className="btn btn--primary" to="/dashboard/reservation">
                  View details
                </Link>
                <Link className="btn" to="/dashboard/chat">
                  Message cafe
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="overviewGrid2">
        <div className="card">
          <div className="cardHeader">
            <div style={{ fontWeight: 700 }}>Quick book</div>
            <Badge tone="neutral">3 steps</Badge>
          </div>

          <div className="formGrid" style={{ marginTop: 12 }}>
            <label className="field">
              <div className="field__label">Party size</div>
              <input value={partySize} onChange={(e) => setPartySize(e.target.value)} type="number" min={1} className="input" />
            </label>

            <label className="field">
              <div className="field__label">Time</div>
              <input value={timeLocal} onChange={(e) => setTimeLocal(e.target.value)} type="datetime-local" className="input" />
            </label>

            <div className="field" style={{ alignSelf: 'end' }}>
              <button className="btn btn--primary" onClick={onQuickBook}>
                Find seats
              </button>
            </div>

            <div className="field" style={{ alignSelf: 'end' }}>
              <Link className="btn" to="/dashboard/floor">
                Browse floor
              </Link>
            </div>
          </div>

          <div className="muted" style={{ marginTop: 10 }}>
            Tip: Start with party size & time. You can pick a table on the Reservation tab.
          </div>
        </div>

        <div className="card">
          <div className="cardHeader">
            <div style={{ fontWeight: 700 }}>Recommendations</div>
            <Badge tone="neutral">Based on availability</Badge>
          </div>

          <div className="stack" style={{ marginTop: 12 }}>
            <div className="miniCard">
              <div className="miniCard__title">Quiet zone</div>
              <div className="muted">Great for studying & meetings.</div>
            </div>
            <div className="miniCard">
              <div className="miniCard__title">Window seats</div>
              <div className="muted">Limited – reserve early.</div>
            </div>
            <div className="miniCard">
              <div className="miniCard__title">Near power outlets</div>
              <div className="muted">Ideal for laptops.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
