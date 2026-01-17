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

function toDate(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  try {
    return new Date(v)
  } catch {
    return null
  }
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
    const qRecent = query(
      collection(db, 'reservations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    )

    const unsub = onSnapshot(
      qRecent,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const now = new Date()
        const normalized = rows.map((r) => {
          const status = String(r.status || '').toLowerCase()
          const holdExpiresAt = toDate(r.holdExpiresAt)
          return { ...r, _status: status, _holdExpiresAt: holdExpiresAt }
        })

        const confirmed = normalized.find((r) => r._status === 'confirmed')
        const hold = normalized.find((r) => r._status === 'hold' && r._holdExpiresAt && r._holdExpiresAt > now)

        setCurrentReservation(confirmed || hold || null)
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

  const statusBadge = useMemo(() => {
    const s = String(reservationSummary?.status || '').toLowerCase()
    if (s === 'confirmed') return { tone: 'success', text: 'Confirmed' }
    if (s === 'hold') return { tone: 'neutral', text: 'Hold' }
    return { tone: 'neutral', text: s || '—' }
  }, [reservationSummary?.status])

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
              <div className="muted">Browsing as guest.</div>
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
                  <Badge tone={statusBadge.tone}>{statusBadge.text}</Badge>
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
