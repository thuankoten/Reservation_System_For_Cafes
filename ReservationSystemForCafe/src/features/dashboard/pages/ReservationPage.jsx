import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'
import { auth, db } from '../../../shared/firebase'
import { useAuth } from '../../auth/AuthContext.jsx'
import { cancelReservation, createHoldReservation } from '../../../shared/services/reservations'
import { calculateTotalAmount } from '../../../shared/utils/pricing'
import {
  buildDateFromISOAndMinutes,
  clampDurationMinutes,
  formatISODate,
  listDurationOptions,
  listStartMinutesForDuration,
  minutesToTimeLabel,
  TIMELINE_CONFIG,
} from '../../../shared/utils/timeline'

function toDate(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  try {
    return new Date(v)
  } catch {
    return null
  }
}

function formatCurrencyVND(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  try {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
  } catch {
    return `${n} VND`
  }
}

function getDefaultStartMinutes({ isoDate, durationMinutes }) {
  const dur = Number(durationMinutes)
  const today = formatISODate(new Date())
  const isToday = isoDate === today

  const startOptions = listStartMinutesForDuration({ durationMinutes: dur })
  if (startOptions.length === 0) return TIMELINE_CONFIG.openMinutes
  if (!isToday) return startOptions[0]

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const roundedUp = Math.ceil(currentMinutes / TIMELINE_CONFIG.stepMinutes) * TIMELINE_CONFIG.stepMinutes
  const candidate = Math.max(TIMELINE_CONFIG.openMinutes, roundedUp)

  const found = startOptions.find((m) => m >= candidate)
  return typeof found === 'number' ? found : startOptions[0]
}

export default function ReservationPage() {
  const { user } = useAuth()
  const [tables, setTables] = useState([])
  const [myReservations, setMyReservations] = useState([])

  const [selectedTableId, setSelectedTableId] = useState('')
  const [partySize, setPartySize] = useState(2)

  const [isoDate, setIsoDate] = useState(() => formatISODate(new Date()))
  const [durationMinutes, setDurationMinutes] = useState(120)
  const [startMinutes, setStartMinutes] = useState(() =>
    getDefaultStartMinutes({ isoDate: formatISODate(new Date()), durationMinutes: 120 })
  )

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')

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

  useEffect(() => {
    if (!user) return

    if (!customerName && user.displayName) setCustomerName(user.displayName)
    if (!customerEmail && user.email) setCustomerEmail(user.email)
  }, [user, customerEmail, customerName])

  const availableTables = useMemo(
    () => tables.filter((t) => (t.status || 'available') === 'available'),
    [tables]
  )

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId) || null,
    [selectedTableId, tables]
  )

  const durationOptions = useMemo(
    () => listDurationOptions({ stepMinutes: TIMELINE_CONFIG.stepMinutes, maxDurationMinutes: TIMELINE_CONFIG.maxDurationMinutes }),
    []
  )

  const startOptions = useMemo(
    () => listStartMinutesForDuration({ durationMinutes: Number(durationMinutes) }),
    [durationMinutes]
  )

  useEffect(() => {
    setDurationMinutes((prev) => clampDurationMinutes(prev))
  }, [])

  useEffect(() => {
    // Ensure current startMinutes is valid after changing date/duration
    const opts = listStartMinutesForDuration({ durationMinutes: Number(durationMinutes) })
    if (!opts.length) {
      setStartMinutes(TIMELINE_CONFIG.openMinutes)
      return
    }
    if (!opts.includes(startMinutes)) {
      setStartMinutes(getDefaultStartMinutes({ isoDate, durationMinutes }))
    }
  }, [durationMinutes, isoDate, startMinutes])

  const pricing = useMemo(() => {
    if (!selectedTable) return null
    const seats = Number(selectedTable.seats)
    const dur = Number(durationMinutes)
    const totalAmount = calculateTotalAmount({ seats, durationMinutes: dur })
    if (totalAmount == null) return null
    return { totalAmount }
  }, [durationMinutes, selectedTable])

  const activeHoldReservation = useMemo(() => {
    const now = new Date()
    for (const r of myReservations) {
      const status = String(r.status || '').toLowerCase()
      if (status !== 'hold') continue
      const expires = toDate(r.holdExpiresAt)
      if (expires && expires > now) return { ...r, holdExpiresAtDate: expires }
    }
    return null
  }, [myReservations])

  const [holdRemainingMs, setHoldRemainingMs] = useState(0)
  useEffect(() => {
    if (!activeHoldReservation?.holdExpiresAtDate) {
      setHoldRemainingMs(0)
      return
    }

    const tick = () => {
      const ms = activeHoldReservation.holdExpiresAtDate.getTime() - Date.now()
      setHoldRemainingMs(Math.max(0, ms))
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [activeHoldReservation?.holdExpiresAtDate])

  const holdCountdownText = useMemo(() => {
    if (!holdRemainingMs) return ''
    const totalSec = Math.ceil(holdRemainingMs / 1000)
    const mm = Math.floor(totalSec / 60)
    const ss = totalSec % 60
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }, [holdRemainingMs])

  async function createReservation() {
    setError('')
    if (!selectedTableId) {
      setError('Please select a table')
      return
    }

    let bookingUser = user
    if (!bookingUser?.uid) {
      try {
        const cred = await signInAnonymously(auth)
        bookingUser = cred.user
      } catch (e) {
        setError(e?.message || 'Failed to start guest session')
        return
      }
    }

    if (!selectedTable) {
      setError('Selected table not found')
      return
    }

    const seats = Number(selectedTable.seats)
    const party = Number(partySize)
    if (Number.isFinite(seats) && Number.isFinite(party) && party > seats) {
      setError('Party size exceeds table capacity')
      return
    }

    setSubmitting(true)
    try {
      await createHoldReservation({
        db,
        user: bookingUser,
        table: selectedTable,
        isoDate,
        startMinutes,
        durationMinutes,
        partySize,
        customerName,
        customerPhone,
        customerEmail,
      })
    } catch (e) {
      setError(e?.message || 'Failed to create reservation')
    } finally {
      setSubmitting(false)
    }
  }

  async function onCancelReservation(reservationId, tableId, slotKeys) {
    setError('')
    try {
      await cancelReservation({ db, reservationId, tableId, slotKeys })
    } catch (e) {
      setError(e?.message || 'Failed to cancel reservation')
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h2 className="pageTitle">Reservation</h2>
        <div className="muted">Hold a table for 5 minutes</div>

        <div className="formGrid" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field__label">Name</div>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input" />
          </label>

          <label className="field">
            <div className="field__label">Phone</div>
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input" />
          </label>

          <label className="field">
            <div className="field__label">Email</div>
            <input
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="input"
              disabled={Boolean(user?.email)}
            />
          </label>

          <label className="field">
            <div className="field__label">Table</div>
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="input"
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
            />
          </label>

          <label className="field">
            <div className="field__label">Date</div>
            <input
              value={isoDate}
              onChange={(e) => setIsoDate(e.target.value)}
              type="date"
              className="input"
            />
          </label>

          <label className="field">
            <div className="field__label">Duration</div>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(clampDurationMinutes(e.target.value))}
              className="input"
            >
              {durationOptions.map((mins) => (
                <option key={mins} value={mins}>
                  {mins / 60}h
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <div className="field__label">Start time</div>
            <select
              value={startMinutes}
              onChange={(e) => setStartMinutes(Number(e.target.value))}
              className="input"
            >
              {startOptions.map((m) => (
                <option key={m} value={m}>
                  {minutesToTimeLabel(m)}
                </option>
              ))}
            </select>
          </label>

          <div className="field" style={{ alignSelf: 'end' }}>
            <button disabled={submitting} onClick={createReservation} className="btn btn--primary">
              {submitting ? 'Creating...' : 'Hold (5 min)'}
            </button>
          </div>
        </div>

        <div className="kv">
          <div className="kv__row">
            <div className="kv__k">Start</div>
            <div className="kv__v">{minutesToTimeLabel(startMinutes)}</div>
          </div>
          <div className="kv__row">
            <div className="kv__k">End</div>
            <div className="kv__v">
              {(() => {
                const end = buildDateFromISOAndMinutes(isoDate, startMinutes + Number(durationMinutes || 0))
                const mins = end.getHours() * 60 + end.getMinutes()
                return minutesToTimeLabel(mins)
              })()}
            </div>
          </div>
          <div className="kv__row">
            <div className="kv__k">Total</div>
            <div className="kv__v">{pricing ? formatCurrencyVND(pricing.totalAmount) : '—'}</div>
          </div>
        </div>

        {activeHoldReservation ? (
          <div className="muted" style={{ marginTop: 12 }}>
            Hold active • expires in <b>{holdCountdownText}</b>
          </div>
        ) : null}

        {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>My reservations</h3>
        <div className="stack">
          {!user ? <div className="muted">Sign in to see your reservation history on this device.</div> : null}
          {user && myReservations.length === 0 ? <div className="muted">No reservations yet.</div> : null}
          {myReservations.map((r) => (
            <div key={r.id} className="rowCard">
              <div>
                <div className="rowCard__title">Table: {r.tableId}</div>
                <div className="muted">Party size: {r.partySize}</div>
                <div className="muted">Status: {r.status}</div>
              </div>
              <div>
                {['active', 'hold', 'confirmed'].includes(String(r.status || '').toLowerCase()) ? (
                  <button onClick={() => onCancelReservation(r.id, r.tableId, r.slotKeys)} className="btn">
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
