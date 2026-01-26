import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'
import { useSearchParams } from 'react-router-dom'
import { auth, db } from '../../../shared/firebase'
import { useAuth } from '../../auth/useAuth'
import { cancelReservation, createHoldReservation, expireReservation } from '../../../shared/services/reservations'
import { calculateTotalAmount } from '../../../shared/utils/pricing'
import {
  formatISODate,
  listStartMinutesForDuration,
  minutesToTimeLabel,
  TIMELINE_CONFIG,
  buildDateFromISOAndMinutes,
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

function clampNumber(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

function computeDefaultEndMinutes({ startMinutes, durationMinutes }) {
  const base = Number(startMinutes)
  const dur = Number(durationMinutes)
  const step = TIMELINE_CONFIG.stepMinutes
  const minEnd = base + step
  const desired = base + (Number.isFinite(dur) ? dur : step)
  const maxEnd = TIMELINE_CONFIG.closeMinutes
  return Math.max(minEnd, Math.min(maxEnd, desired))
}

export default function ReservationPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [initialTableId] = useState(() => searchParams.get('tableId') || '')
  const [tables, setTables] = useState([])
  const [reservations, setReservations] = useState([])
  const [myReservations, setMyReservations] = useState([])

  const [selectedTableId, setSelectedTableId] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [partySizeTouched, setPartySizeTouched] = useState(false)

  const [isoDate, setIsoDate] = useState(() => formatISODate(new Date()))
  const [durationMinutes] = useState(120)
  const [startMinutes, setStartMinutes] = useState(() =>
    getDefaultStartMinutes({ isoDate: formatISODate(new Date()), durationMinutes: 120 })
  )
  const [endMinutes, setEndMinutes] = useState(() =>
    computeDefaultEndMinutes({
      startMinutes: getDefaultStartMinutes({ isoDate: formatISODate(new Date()), durationMinutes: 120 }),
      durationMinutes: 120,
    })
  )

  const [customerName, setCustomerName] = useState('')
  const [customerNameTouched, setCustomerNameTouched] = useState(false)
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerEmailTouched, setCustomerEmailTouched] = useState(false)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const qTables = query(collection(db, 'tables'), orderBy('number', 'asc'))
    const unsub = onSnapshot(
      qTables,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setTables(rows)

        setSelectedTableId((prev) => {
          if (prev && rows.some((t) => t.id === prev)) return prev
          if (initialTableId && rows.some((t) => t.id === initialTableId)) return initialTableId
          const firstSelectable = rows.find((t) => String(t.status || 'available').toLowerCase() !== 'occupied')
          return firstSelectable ? firstSelectable.id : ''
        })
      },
      (e) => setError(e?.message || 'Failed to load tables')
    )

    return () => unsub()
  }, [initialTableId])

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'), limit(100))
    const unsub = onSnapshot(
      q,
      (snap) => setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setReservations([])
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user?.uid) return

    const qMine = query(
      collection(db, 'reservations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    )

    const unsub = onSnapshot(
      qMine,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setMyReservations(rows)

        const now = new Date()
        for (const r of rows) {
          const status = String(r.status || '').toLowerCase()
          if (status !== 'hold') continue
          const expiresAt = toDate(r.holdExpiresAt)
          if (expiresAt && expiresAt <= now) {
            expireReservation({ db, reservationId: r.id }).catch(() => {})
          }
        }
      },
      (e) => setError(e?.message || 'Failed to load reservations')
    )

    return () => unsub()
  }, [user?.uid])

  const customerNameValue = customerNameTouched ? customerName : (user?.displayName || customerName)
  const customerEmailValue = user?.email ? user.email : (customerEmailTouched ? customerEmail : customerEmail)

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId) || null,
    [selectedTableId, tables]
  )

  const allTableOptions = useMemo(
    () => tables.slice().sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0)),
    [tables]
  )

  const selectedRange = useMemo(() => {
    const start = buildDateFromISOAndMinutes(isoDate, Number(startMinutes))
    const end = buildDateFromISOAndMinutes(isoDate, Number(endMinutes))
    return { start, end }
  }, [endMinutes, isoDate, startMinutes])

  const reservedTableIdsForSelectedRange = useMemo(() => {
    const now = new Date()
    const set = new Set()

    const selectedStart = selectedRange.start
    const selectedEnd = selectedRange.end
    if (!(selectedStart instanceof Date) || !(selectedEnd instanceof Date)) return set
    if (Number.isNaN(selectedStart.getTime()) || Number.isNaN(selectedEnd.getTime())) return set
    if (selectedEnd <= selectedStart) return set

    for (const r of reservations) {
      if (!r?.tableId) continue
      const status = String(r.status || '').toLowerCase()
      if (status !== 'confirmed' && status !== 'hold') continue

      if (status === 'hold') {
        const expiresAt = toDate(r.holdExpiresAt)
        if (!expiresAt || expiresAt <= now) continue
      }

      const rStart = toDate(r.startTime)
      const rEnd = toDate(r.endTime)
      if (!(rStart instanceof Date) || !(rEnd instanceof Date)) continue
      if (Number.isNaN(rStart.getTime()) || Number.isNaN(rEnd.getTime())) continue

      if (formatISODate(rStart) !== isoDate) continue

      const overlaps = rStart < selectedEnd && rEnd > selectedStart
      if (overlaps) set.add(r.tableId)
    }

    return set
  }, [isoDate, reservations, selectedRange.end, selectedRange.start])

  const selectedEffectiveStatus = useMemo(() => {
    const st = String(selectedTable?.status || 'available').toLowerCase()
    if (!selectedTable?.id) return st
    if (st === 'occupied') return 'occupied'
    if (reservedTableIdsForSelectedRange.has(selectedTable.id)) return 'reserved'
    return st
  }, [reservedTableIdsForSelectedRange, selectedTable?.id, selectedTable?.status])

  const isSelectedTableUnavailable = selectedEffectiveStatus === 'reserved' || selectedEffectiveStatus === 'occupied'

  const minPartySize = 1
  const maxPartySize = Number.isFinite(Number(selectedTable?.seats)) ? Number(selectedTable?.seats) + 1 : 1

  useEffect(() => {
    const seats = Number(selectedTable?.seats)
    const nextMax = Number.isFinite(seats) ? seats + 1 : 1

    if (!partySizeTouched && Number.isFinite(seats) && seats > 0) {
      setPartySize(seats)
      return
    }

    setPartySize((p) => clampNumber(p, 1, Math.max(1, nextMax)))
  }, [partySizeTouched, selectedTable?.seats])

  const startOptions = useMemo(
    () => listStartMinutesForDuration({ durationMinutes: TIMELINE_CONFIG.stepMinutes }),
    []
  )

  const endOptions = useMemo(() => {
    const step = TIMELINE_CONFIG.stepMinutes
    const start = Number(startMinutes)
    if (!Number.isFinite(start)) return []

    const latestEnd = Math.min(TIMELINE_CONFIG.closeMinutes, start + TIMELINE_CONFIG.maxDurationMinutes)
    const out = []
    for (let m = start + step; m <= latestEnd; m += step) out.push(m)
    return out
  }, [startMinutes])

  useEffect(() => {
    setEndMinutes((prev) => {
      const step = TIMELINE_CONFIG.stepMinutes
      const start = Number(startMinutes)
      if (!Number.isFinite(start)) return prev
      const minEnd = start + step
      const maxEnd = Math.min(TIMELINE_CONFIG.closeMinutes, start + TIMELINE_CONFIG.maxDurationMinutes)
      return clampNumber(prev, minEnd, maxEnd)
    })
  }, [startMinutes])

  const derivedDurationMinutes = useMemo(() => {
    const d = Number(endMinutes) - Number(startMinutes)
    if (!Number.isFinite(d) || d <= 0) return TIMELINE_CONFIG.stepMinutes
    return d
  }, [endMinutes, startMinutes])

  function onChangeDate(nextIso) {
    setIsoDate(nextIso)
    const nextStart = getDefaultStartMinutes({ isoDate: nextIso, durationMinutes })
    setStartMinutes(nextStart)
    setEndMinutes(computeDefaultEndMinutes({ startMinutes: nextStart, durationMinutes }))
  }

  const pricing = useMemo(() => {
    if (!selectedTable) return null
    const seats = Number(selectedTable.seats)
    const dur = Number(derivedDurationMinutes)
    const totalAmount = calculateTotalAmount({ seats, durationMinutes: dur })
    if (totalAmount == null) return null
    return { totalAmount }
  }, [derivedDurationMinutes, selectedTable])

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
    if (!activeHoldReservation?.holdExpiresAtDate) return

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

  const myReservationRows = useMemo(() => {
    const now = new Date()
    return myReservations.map((r) => {
      const status = String(r.status || '').toLowerCase()
      const expiresAt = toDate(r.holdExpiresAt)
      const startTime = toDate(r.startTime)
      const endTime = toDate(r.endTime)
      const isHoldActive = status === 'hold' && expiresAt && expiresAt > now
      const statusLabel = status === 'confirmed' ? 'Confirmed' : status === 'hold' ? (isHoldActive ? 'Pending approval' : 'Expired') : status || '—'
      return { ...r, _status: status, _expiresAt: expiresAt, _startTime: startTime, _endTime: endTime, _isHoldActive: isHoldActive, _statusLabel: statusLabel }
    })
  }, [myReservations])

  async function createReservation() {
    setError('')
    if (!selectedTableId) {
      setError('Please select a table')
      return
    }

    if (activeHoldReservation) {
      setError('You already have a pending reservation. Please wait for admin confirmation or cancel it.')
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

    if (String(selectedTable.status || 'available').toLowerCase() === 'occupied') {
      setError('Selected table is occupied')
      return
    }
    if (reservedTableIdsForSelectedRange.has(selectedTable.id)) {
      setError('This table is not available for the selected time')
      return
    }

    const dur = Number(derivedDurationMinutes)
    if (!Number.isFinite(dur) || dur <= 0) {
      setError('Invalid time range')
      return
    }
    if (dur % TIMELINE_CONFIG.stepMinutes !== 0) {
      setError('Time must be in 30-minute blocks')
      return
    }
    if (dur > TIMELINE_CONFIG.maxDurationMinutes) {
      setError('Duration exceeds max (6h)')
      return
    }

    const seats = Number(selectedTable.seats)
    const party = Number(partySize)
    if (!Number.isFinite(party) || party < 1) {
      setError('Party size must be at least 1')
      return
    }
    if (Number.isFinite(seats) && Number.isFinite(party) && party > seats + 1) {
      setError('Party size exceeds max allowed (seats + 1)')
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
        durationMinutes: derivedDurationMinutes,
        partySize,
        customerName: customerNameValue,
        customerPhone,
        customerEmail: customerEmailValue,
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
        <div className="muted">Reserve request (pending admin confirmation). Expires in 5 minutes.</div>

        <div className="formGrid" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field__label">Name</div>
            <input
              value={customerNameValue}
              onChange={(e) => {
                if (!customerNameTouched) setCustomerNameTouched(true)
                setCustomerName(e.target.value)
              }}
              className="input"
            />
          </label>

          <label className="field">
            <div className="field__label">Phone</div>
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input" />
          </label>

          <label className="field">
            <div className="field__label">Email</div>
            <input
              value={customerEmailValue}
              onChange={(e) => {
                if (!customerEmailTouched) setCustomerEmailTouched(true)
                setCustomerEmail(e.target.value)
              }}
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
              {allTableOptions.map((t) => {
                const st = String(t.status || 'available').toLowerCase()
                const effectiveStatus = st === 'occupied' ? 'occupied' : reservedTableIdsForSelectedRange.has(t.id) ? 'reserved' : st
                const label = effectiveStatus === 'occupied' ? 'Occupied' : effectiveStatus === 'reserved' ? 'Reserved' : effectiveStatus === 'available' ? 'Free' : effectiveStatus
                const disabled = effectiveStatus === 'occupied' || effectiveStatus === 'reserved'
                return (
                  <option key={t.id} value={t.id} disabled={disabled}>
                    Table {t.number} (seats: {t.seats || '?'}) • {label}
                  </option>
                )
              })}
            </select>
          </label>

          <label className="field">
            <div className="field__label">Party size</div>
            <input
              value={partySize}
              onChange={(e) => {
                if (!partySizeTouched) setPartySizeTouched(true)
                const next = clampNumber(e.target.value, minPartySize, Math.max(1, maxPartySize))
                setPartySize(next)
              }}
              type="number"
              min={1}
              max={Math.max(1, maxPartySize)}
              className="input"
            />
          </label>

          <label className="field">
            <div className="field__label">Date</div>
            <input
              value={isoDate}
              onChange={(e) => onChangeDate(e.target.value)}
              type="date"
              className="input"
            />
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

          <label className="field">
            <div className="field__label">End time</div>
            <select
              value={endMinutes}
              onChange={(e) => setEndMinutes(Number(e.target.value))}
              className="input"
            >
              {endOptions.map((m) => (
                <option key={m} value={m}>
                  {minutesToTimeLabel(m)}
                </option>
              ))}
            </select>
          </label>

          <div className="field" style={{ alignSelf: 'end' }}>
            <button
              disabled={submitting || isSelectedTableUnavailable}
              onClick={createReservation}
              className="btn btn--primary"
            >
              {submitting ? 'Creating...' : 'Reserve'}
            </button>
          </div>
        </div>

        {isSelectedTableUnavailable ? (
          <div className="error" style={{ marginTop: 12 }}>
            This table is not available for the selected time.
          </div>
        ) : null}

        <div className="kv">
          <div className="kv__row">
            <div className="kv__k">Start time</div>
            <div className="kv__v">{minutesToTimeLabel(startMinutes)}</div>
          </div>
          <div className="kv__row">
            <div className="kv__k">End time</div>
            <div className="kv__v">{minutesToTimeLabel(Number(endMinutes))}</div>
          </div>
          <div className="kv__row">
            <div className="kv__k">Total</div>
            <div className="kv__v">{pricing ? formatCurrencyVND(pricing.totalAmount) : '—'}</div>
          </div>
        </div>

        {activeHoldReservation ? (
          <div className="muted" style={{ marginTop: 12 }}>
            Pending approval • expires in <b>{holdCountdownText}</b>
          </div>
        ) : null}

        {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>My reservations</h3>
        <div className="stack">
          {!user ? <div className="muted">Sign in to see your reservation history on this device.</div> : null}
          {user && myReservations.length === 0 ? <div className="muted">No reservations yet.</div> : null}
          {myReservationRows.map((r) => (
            <div key={r.id} className="rowCard">
              <div>
                <div className="rowCard__title">Table: {r.tableNumber ?? r.tableId}</div>
                <div className="muted">Party size: {r.partySize ?? '—'}</div>
                <div className="muted">Time: {r._startTime ? r._startTime.toLocaleString() : '—'} → {r._endTime ? r._endTime.toLocaleString() : '—'}</div>
                <div className="muted">Status: {r._statusLabel}</div>
              </div>
              <div>
                {['hold', 'confirmed'].includes(String(r._status || '').toLowerCase()) ? (
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
