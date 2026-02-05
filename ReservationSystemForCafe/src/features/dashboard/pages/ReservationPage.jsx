import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { showErrorAlert } from '../../../shared/utils/errorAlert'
import { useAuth } from '../../auth/useAuth'
import { getReservedTableIdsForRange } from '../../../modules/reservations/domain/policies/availabilityPolicy'
import { useTablesQuery } from '../../../modules/tables/application/queries/useTablesQuery'
import { useReservationsQuery } from '../../../modules/reservations/application/queries/useReservationsQuery'
import { useMyReservationsQuery } from '../../../modules/reservations/application/queries/useMyReservationsQuery'
import { buildMyReservationRows, groupMyReservations } from '../../../modules/reservations/application/presenters/customerMyReservationsPresenter'
import { useServices } from '../../../app/ServiceContext'
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

// Pricing removed from customer reservation flow.

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
  const { useCases } = useServices()
  const navigate = useNavigate()
  const DRAFT_KEY = 'reservationDraft'
  const [searchParams] = useSearchParams()
  const [initialTableId] = useState(() => searchParams.get('tableId') || '')
  const [autoSelectTable, setAutoSelectTable] = useState(false)
  const { rows: tables, error: tablesError } = useTablesQuery()
  const { rows: reservations, error: reservationsError } = useReservationsQuery()
  const { rows: myReservations, error: myReservationsError } = useMyReservationsQuery({ userId: user?.uid })
  const [expandedIds, setExpandedIds] = useState(() => new Set())

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
  const [editingReservation, setEditingReservation] = useState(null)
  const [editDialog, setEditDialog] = useState({ open: false })

  // Hydrate form from draft saved before redirecting to login
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      if (d && typeof d === 'object') {
        if (d.isoDate) setIsoDate(String(d.isoDate))
        if (Number.isFinite(Number(d.startMinutes))) setStartMinutes(Number(d.startMinutes))
        if (Number.isFinite(Number(d.endMinutes))) setEndMinutes(Number(d.endMinutes))
        if (Number.isFinite(Number(d.partySize))) {
          setPartySize(Number(d.partySize))
          setPartySizeTouched(true)
        }
        if (typeof d.customerName === 'string') {
          setCustomerName(d.customerName)
          setCustomerNameTouched(Boolean(d.customerName))
        }
        if (typeof d.customerEmail === 'string') {
          setCustomerEmail(d.customerEmail)
          setCustomerEmailTouched(Boolean(d.customerEmail))
        }
        if (typeof d.customerPhone === 'string') setCustomerPhone(d.customerPhone)
        if (typeof d.selectedTableId === 'string') setSelectedTableId(d.selectedTableId)
      }
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      void 0
    }
  }, [])

  useEffect(() => {
    if (tablesError) setError(tablesError)
  }, [tablesError])

  useEffect(() => {
    if (reservationsError) setError(reservationsError)
  }, [reservationsError])

  useEffect(() => {
    if (myReservationsError) setError(myReservationsError)
  }, [myReservationsError])

  useEffect(() => {
    if (!tables || tables.length === 0) return
    setSelectedTableId((prev) => {
      if (prev && tables.some((t) => t.id === prev)) return prev
      if (initialTableId && tables.some((t) => t.id === initialTableId)) return initialTableId
      if (autoSelectTable && tables.length > 0) return tables[0]?.id || ''
      return ''
    })
  }, [autoSelectTable, initialTableId, tables])

  useEffect(() => {
    if (!user?.uid) {
      setExpandedIds(new Set())
      return
    }

    const now = new Date()
    for (const r of myReservations) {
      const status = String(r.status || '').toLowerCase()
      if (status !== 'hold') continue
      const holdDeadline = toDate(r.holdExpiresAt)
      if (holdDeadline && holdDeadline <= now) {
        useCases.cancelHoldReservation.execute({ reservation: r }).catch(() => null)
      }
    }
  }, [myReservations, user?.uid, useCases.cancelHoldReservation])

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
    return getReservedTableIdsForRange({
      reservations,
      isoDate,
      startDate: selectedRange.start,
      endDate: selectedRange.end,
    })
  }, [isoDate, reservations, selectedRange.end, selectedRange.start])

  const selectedEffectiveStatus = useMemo(() => {
    const st = String(selectedTable?.status || 'available').toLowerCase()
    if (!selectedTable?.id) return st
    if (st === 'occupied') return 'occupied'
    if (reservedTableIdsForSelectedRange.has(selectedTable.id)) return 'reserved'
    // Ignore table's day-wide 'reserved' flag; availability is time-based here
    return 'available'
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

  const startOptions = useMemo(() => {
    const base = listStartMinutesForDuration({ durationMinutes: TIMELINE_CONFIG.stepMinutes })
    const today = formatISODate(new Date())
    if (isoDate !== today) return base
    const step = TIMELINE_CONFIG.stepMinutes
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const earliest = Math.ceil(currentMinutes / step) * step
    return base.filter((m) => m >= earliest)
  }, [isoDate])

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

  // Pricing removed

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

  // Hold countdown removed

  const myReservationRows = useMemo(() => {
    return buildMyReservationRows({ myReservations })
  }, [myReservations])

  // Group reservations into sections per request
  const groupedMyReservations = useMemo(() => {
    return groupMyReservations({ myReservationRows })
  }, [myReservationRows])

  async function createReservation() {
    setError('')
    if (!selectedTableId) {
      setError('Please select a table')
      showErrorAlert('Please select a table')
      return
    }

    // Chặn chắc chắn nếu bàn không khả dụng
    if (isSelectedTableUnavailable) {
      setError('This table is not available for the selected time')
      showErrorAlert('Selected table is unavailable')
      return
    }

    if (activeHoldReservation) {
      setError('You already have a pending reservation. Please wait for admin confirmation or cancel it.')
      showErrorAlert('You already have a pending reservation. Please wait for confirmation or cancel it.')
      return
    }
    if (!selectedTable) {
      setError('Selected table not found')
      showErrorAlert('Selected table not found')
      return
    }

    if (String(selectedTable.status || 'available').toLowerCase() === 'occupied') {
      setError('Selected table is occupied')
      showErrorAlert('Selected table is occupied')
      return
    }
    if (reservedTableIdsForSelectedRange.has(selectedTable.id)) {
      setError('This table is not available for the selected time')
      return
    }

    // Disallow booking in the past when booking for today
    const selectedStartDate = buildDateFromISOAndMinutes(isoDate, Number(startMinutes))
    const now = new Date()
    if (formatISODate(selectedStartDate) === formatISODate(now) && selectedStartDate <= now) {
      setError('Start time must be in the future')
      showErrorAlert('Start time must be in the future')
      return
    }

    const dur = Number(derivedDurationMinutes)
    if (!Number.isFinite(dur) || dur <= 0) {
      setError('Invalid time range')
      showErrorAlert('Invalid time range')
      return
    }
    if (dur % TIMELINE_CONFIG.stepMinutes !== 0) {
      setError('Time must be in 30-minute blocks')
      showErrorAlert('Time must be in 30-minute blocks')
      return
    }
    if (dur > TIMELINE_CONFIG.maxDurationMinutes) {
      setError('Duration exceeds max (6h)')
      showErrorAlert('Duration exceeds max (6h)')
      return
    }

    const seats = Number(selectedTable.seats)
    const party = Number(partySize)
    if (!Number.isFinite(party) || party < 1) {
      setError('Party size must be at least 1')
      showErrorAlert('Party size must be at least 1')
      return
    }
    if (Number.isFinite(seats) && Number.isFinite(party) && party > seats + 1) {
      setError('Party size exceeds max allowed (seats + 1)')
      showErrorAlert('Party size exceeds max allowed (seats + 1)')
      return
    }

    setSubmitting(true)
    try {
      const bookingUser = !user?.uid || user?.isAnonymous
        ? await useCases.ensureBookingUser.execute({ displayName: customerNameValue })
        : user

      const reservationId = await useCases.createHoldReservation.execute({
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
      if (reservationId) {
        // Show success message and redirect to overview
        const confirmed = window.confirm('Reservation request submitted successfully! Awaiting approval.')
        if (confirmed) {
          navigate('/dashboard/overview')
        }
        // Reset selection to placeholder to avoid immediate unavailable error for the same slot
        setAutoSelectTable(false)
        setSelectedTableId('')
      }
    } catch (e) {
      const msg = e?.message || 'Failed to create reservation'
      setError(msg)
      showErrorAlert(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function onCancelReservation(reservationId, tableId, slotKeys) {
    setError('')
    try {
      await useCases.cancelHoldReservation.execute({
        reservation: { id: reservationId, tableId, slotKeys },
      })
    } catch (e) {
      const msg = e?.message || 'Failed to cancel reservation'
      setError(msg)
      showErrorAlert(msg)
    }
  }

  function openEditDialog(reservation) {
    setEditingReservation({ ...reservation })
    setEditDialog({ open: true })
  }

  function closeEditDialog() {
    setEditDialog({ open: false })
    setEditingReservation(null)
  }

  async function saveEditReservation() {
    if (!editingReservation) return
    setError('')
    try {
      await useCases.cancelHoldReservation.execute({ reservation: editingReservation })

      const updatedTable = tables.find((t) => t.id === editingReservation.tableId)
      if (!updatedTable) {
        setError('Table not found')
        return
      }

      const resIsoDate = editingReservation.isoDate || formatISODate(toDate(editingReservation.startTime))
      const bookingUser = !user?.uid || user?.isAnonymous
        ? await useCases.ensureBookingUser.execute({ displayName: editingReservation.customerName })
        : user

      const newResId = await useCases.createHoldReservation.execute({
        user: bookingUser,
        table: updatedTable,
        isoDate: resIsoDate,
        startMinutes: editingReservation.startMinutes,
        durationMinutes: editingReservation.durationMinutes,
        partySize: editingReservation.partySize,
        customerName: editingReservation.customerName,
        customerPhone: editingReservation.customerPhone,
        customerEmail: editingReservation.customerEmail,
      })

      if (newResId) {
        window.confirm('Reservation updated successfully!')
        closeEditDialog()
      }
    } catch (e) {
      const msg = e?.message || 'Failed to update reservation'
      setError(msg)
      showErrorAlert(msg)
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h2 className="pageTitle">Reservation</h2>
        <div style={{ 
          marginBottom: 16, 
          padding: '12px 16px', 
          backgroundColor: '#f0f9ff', 
          border: '1px solid #bfdbfe',
          borderRadius: '6px',
          fontSize: '14px',
          color: '#1e40af'
        }}>
          For the best experience, please <strong><a href="/dashboard/instructions" style={{ color: '#0369a1', textDecoration: 'underline', cursor: 'pointer' }}>read our guidelines</a></strong> before making your reservation.
        </div>
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
                const effectiveStatus = st === 'occupied' ? 'occupied' : reservedTableIdsForSelectedRange.has(t.id) ? 'reserved' : 'available'
                const label = effectiveStatus === 'occupied' ? 'Occupied' : effectiveStatus === 'reserved' ? 'Reserved' : 'Free'
                const disabled = effectiveStatus === 'occupied'
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

        {error ? (
          <div className="error" style={{ marginTop: 12 }}>
            {error}
          </div>
        ) : null}

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
          {/* Total amount removed */}
        </div>

        {/* Pending approval countdown removed */}

        {/* Errors are shown via alert globally; no inline error box */}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>My reservations</h3>
        <div className="stack">
          {!user?.uid ? <div className="muted">Make a reservation to see it here.</div> : null}
          {user?.uid && myReservations.length === 0 ? <div className="muted">No reservations yet.</div> : null}

          {user?.uid ? (
            <>
              {groupedMyReservations.waitingToday.length > 0 ? (
                <>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>Waiting for approval</div>
                  {groupedMyReservations.waitingToday.map((r) => (
                    <div
                      key={r.id}
                      className="rowCard"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setExpandedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(r.id)) next.delete(r.id)
                          else next.add(r.id)
                          return next
                        })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setExpandedIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(r.id)) next.delete(r.id)
                            else next.add(r.id)
                            return next
                          })
                        }
                      }}
                    >
                      <div>
                        <div className="rowCard__title">Table: {r.tableNumber ?? r.tableId}</div>
                        <div className="muted">Party size: {r.partySize ?? '—'}</div>
                        <div className="muted">Time: {r._startTime ? r._startTime.toLocaleString() : '—'} → {r._endTime ? r._endTime.toLocaleString() : '—'}</div>
                        <div className="muted">Status: {r._statusLabel}</div>
                        {expandedIds.has(r.id) ? (
                          <div className="kv" style={{ marginTop: 8 }}>
                            <div className="kv__row"><div className="kv__k">Name</div><div className="kv__v">{r.customerName ?? '—'}</div></div>
                            <div className="kv__row"><div className="kv__k">Phone</div><div className="kv__v">{r.customerPhone ?? '—'}</div></div>
                            <div className="kv__row"><div className="kv__k">Email</div><div className="kv__v">{r.customerEmail ?? r.userEmail ?? '—'}</div></div>
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => openEditDialog(r)} className="btn">Edit</button>
                        <button onClick={() => onCancelReservation(r.id, r.tableId, r.slotKeys)} className="btn">Cancel</button>
                      </div>
                    </div>
                  ))}
                </>
              ) : null}

              {groupedMyReservations.waitingUpcoming.length > 0 ? (
                <>
                  <div style={{ marginTop: 12, fontWeight: 700 }}>Next days (Pending approval)</div>
                  {groupedMyReservations.waitingUpcoming.map((r) => (
                    <div key={r.id} className="rowCard" role="button" tabIndex={0}
                      onClick={() => {
                        setExpandedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(r.id)) next.delete(r.id)
                          else next.add(r.id)
                          return next
                        })
                      }}
                    >
                      <div>
                        <div className="rowCard__title">Table: {r.tableNumber ?? r.tableId}</div>
                        <div className="muted">Party size: {r.partySize ?? '—'}</div>
                        <div className="muted">Time: {r._startTime ? r._startTime.toLocaleString() : '—'} → {r._endTime ? r._endTime.toLocaleString() : '—'}</div>
                        <div className="muted">Status: {r._statusLabel}</div>
                        {expandedIds.has(r.id) ? (
                          <div className="kv" style={{ marginTop: 8 }}>
                            <div className="kv__row"><div className="kv__k">Name</div><div className="kv__v">{r.customerName ?? '—'}</div></div>
                            <div className="kv__row"><div className="kv__k">Phone</div><div className="kv__v">{r.customerPhone ?? '—'}</div></div>
                            <div className="kv__row"><div className="kv__k">Email</div><div className="kv__v">{r.customerEmail ?? r.userEmail ?? '—'}</div></div>
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => openEditDialog(r)} className="btn">Edit</button>
                        <button onClick={() => onCancelReservation(r.id, r.tableId, r.slotKeys)} className="btn">Cancel</button>
                      </div>
                    </div>
                  ))}
                </>
              ) : null}

              {groupedMyReservations.today.length > 0 ? (
                <>
                  <div style={{ marginTop: 12, fontWeight: 700 }}>Reservations today</div>
                  {groupedMyReservations.today.map((r) => (
                    <div key={r.id} className="rowCard" role="button" tabIndex={0}
                      onClick={() => {
                        setExpandedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(r.id)) next.delete(r.id)
                          else next.add(r.id)
                          return next
                        })
                      }}
                    >
                      <div>
                        <div className="rowCard__title">Table: {r.tableNumber ?? r.tableId}</div>
                        <div className="muted">Party size: {r.partySize ?? '—'}</div>
                        <div className="muted">Time: {r._startTime ? r._startTime.toLocaleString() : '—'} → {r._endTime ? r._endTime.toLocaleString() : '—'}</div>
                        <div className="muted">Status: {r._statusLabel}</div>
                        {expandedIds.has(r.id) ? (
                          <div className="kv" style={{ marginTop: 8 }}>
                            <div className="kv__row"><div className="kv__k">Name</div><div className="kv__v">{r.customerName ?? '—'}</div></div>
                            <div className="kv__row"><div className="kv__k">Phone</div><div className="kv__v">{r.customerPhone ?? '—'}</div></div>
                            <div className="kv__row"><div className="kv__k">Email</div><div className="kv__v">{r.customerEmail ?? r.userEmail ?? '—'}</div></div>
                          </div>
                        ) : null}
                      </div>
                      <div>
                        {['hold', 'confirmed'].includes(String(r._status || '').toLowerCase()) ? (
                          <button onClick={() => onCancelReservation(r.id, r.tableId, r.slotKeys)} className="btn">Cancel</button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </>
              ) : null}

              {groupedMyReservations.upcoming.length > 0 ? (
                <>
                  <div style={{ marginTop: 12, fontWeight: 700 }}>Next days</div>
                  {groupedMyReservations.upcoming.map((r) => (
                    <div key={r.id} className="rowCard" role="button" tabIndex={0}
                      onClick={() => {
                        setExpandedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(r.id)) next.delete(r.id)
                          else next.add(r.id)
                          return next
                        })
                      }}
                    >
                      <div>
                        <div className="rowCard__title">Table: {r.tableNumber ?? r.tableId}</div>
                        <div className="muted">Party size: {r.partySize ?? '—'}</div>
                        <div className="muted">Time: {r._startTime ? r._startTime.toLocaleString() : '—'} → {r._endTime ? r._endTime.toLocaleString() : '—'}</div>
                        <div className="muted">Status: {r._statusLabel}</div>
                        {expandedIds.has(r.id) ? (
                          <div className="kv" style={{ marginTop: 8 }}>
                            <div className="kv__row"><div className="kv__k">Name</div><div className="kv__v">{r.customerName ?? '—'}</div></div>
                            <div className="kv__row"><div className="kv__k">Phone</div><div className="kv__v">{r.customerPhone ?? '—'}</div></div>
                            <div className="kv__row"><div className="kv__k">Email</div><div className="kv__v">{r.customerEmail ?? r.userEmail ?? '—'}</div></div>
                          </div>
                        ) : null}
                      </div>
                      <div>
                        {['hold', 'confirmed'].includes(String(r._status || '').toLowerCase()) ? (
                          <button onClick={() => onCancelReservation(r.id, r.tableId, r.slotKeys)} className="btn">Cancel</button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </>
              ) : null}

              {groupedMyReservations.yday.length > 0 ? (
                <>
                  <div style={{ marginTop: 12, fontWeight: 700 }}>Yesterday</div>
                  {groupedMyReservations.yday.map((r) => (
                    <div key={r.id} className="rowCard" role="button" tabIndex={0}
                      onClick={() => {
                        setExpandedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(r.id)) next.delete(r.id)
                          else next.add(r.id)
                          return next
                        })
                      }}
                    >
                      <div>
                        <div className="rowCard__title">Table: {r.tableNumber ?? r.tableId}</div>
                        <div className="muted">Party size: {r.partySize ?? '—'}</div>
                        <div className="muted">Time: {r._startTime ? r._startTime.toLocaleString() : '—'} → {r._endTime ? r._endTime.toLocaleString() : '—'}</div>
                        <div className="muted">Status: {r._statusLabel}</div>
                        {expandedIds.has(r.id) ? (
                          <div className="kv" style={{ marginTop: 8 }}>
                            <div className="kv__row"><div className="kv__k">Name</div><div className="kv__v">{r.customerName ?? '—'}</div></div>
                            <div className="kv__row"><div className="kv__k">Phone</div><div className="kv__v">{r.customerPhone ?? '—'}</div></div>
                            <div className="kv__row"><div className="kv__k">Email</div><div className="kv__v">{r.customerEmail ?? r.userEmail ?? '—'}</div></div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </>
              ) : null}

              {groupedMyReservations.older.length > 0 ? (
                <>
                  <div style={{ marginTop: 12, fontWeight: 700 }}>Older</div>
                  {groupedMyReservations.older.map((r) => (
                    <div key={r.id} className="rowCard" role="button" tabIndex={0}
                      onClick={() => {
                        setExpandedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(r.id)) next.delete(r.id)
                          else next.add(r.id)
                          return next
                        })
                      }}
                    >
                      <div>
                        <div className="rowCard__title">Table: {r.tableNumber ?? r.tableId}</div>
                        <div className="muted">Party size: {r.partySize ?? '—'}</div>
                        <div className="muted">Time: {r._startTime ? r._startTime.toLocaleString() : '—'} → {r._endTime ? r._endTime.toLocaleString() : '—'}</div>
                        <div className="muted">Status: {r._statusLabel}</div>
                        {expandedIds.has(r.id) ? (
                          <div className="kv" style={{ marginTop: 8 }}>
                            <div className="kv__row"><div className="kv__k">Name</div><div className="kv__v">{r.customerName ?? '—'}</div></div>
                            <div className="kv__row"><div className="kv__k">Phone</div><div className="kv__v">{r.customerPhone ?? '—'}</div></div>
                            <div className="kv__row"><div className="kv__k">Email</div><div className="kv__v">{r.customerEmail ?? r.userEmail ?? '—'}</div></div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {/* Edit Reservation Dialog */}
      {editDialog.open && editingReservation ? (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Edit Reservation</h3>

            <div className="formGrid" style={{ gap: '12px' }}>
              <label className="field">
                <div className="field__label">Party Size</div>
                <input
                  type="number"
                  min="1"
                  max={maxPartySize}
                  value={editingReservation.partySize}
                  onChange={(e) => setEditingReservation({ ...editingReservation, partySize: Number(e.target.value) })}
                  className="input"
                />
              </label>

              <label className="field">
                <div className="field__label">Start Time (minutes)</div>
                <input
                  type="number"
                  value={editingReservation.startMinutes || 0}
                  onChange={(e) => setEditingReservation({ ...editingReservation, startMinutes: Number(e.target.value) })}
                  className="input"
                />
              </label>

              <label className="field">
                <div className="field__label">Duration (minutes)</div>
                <input
                  type="number"
                  min="30"
                  step="30"
                  value={editingReservation.durationMinutes || 120}
                  onChange={(e) => setEditingReservation({ ...editingReservation, durationMinutes: Number(e.target.value) })}
                  className="input"
                />
              </label>

              <label className="field">
                <div className="field__label">Name</div>
                <input
                  value={editingReservation.customerName}
                  onChange={(e) => setEditingReservation({ ...editingReservation, customerName: e.target.value })}
                  className="input"
                />
              </label>

              <label className="field">
                <div className="field__label">Phone</div>
                <input
                  value={editingReservation.customerPhone}
                  onChange={(e) => setEditingReservation({ ...editingReservation, customerPhone: e.target.value })}
                  className="input"
                />
              </label>

              <label className="field">
                <div className="field__label">Email</div>
                <input
                  value={editingReservation.customerEmail}
                  onChange={(e) => setEditingReservation({ ...editingReservation, customerEmail: e.target.value })}
                  className="input"
                />
              </label>
            </div>

            {error ? <div className="error" style={{ marginTop: '12px' }}>{error}</div> : null}

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={closeEditDialog} className="btn" style={{ backgroundColor: '#d1d5db', color: '#1f2937' }}>Cancel</button>
              <button onClick={saveEditReservation} className="btn">Save Changes</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
