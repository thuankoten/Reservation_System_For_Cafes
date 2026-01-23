import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../../shared/firebase'
import { cancelReservation, confirmHoldReservation, expireReservation } from '../../../shared/services/reservations'

function toDate(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  try {
    return new Date(v)
  } catch {
    return null
  }
}

function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00'
  const totalSec = Math.ceil(ms / 1000)
  const mm = Math.floor(totalSec / 60)
  const ss = totalSec % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export default function AdminReservationsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'), limit(200))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setError('')
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (e) => {
        setError(e?.message || 'Failed to load reservations')
        setRows([])
        setLoading(false)
      }
    )

    return () => unsub()
  }, [])

  const pendingRows = useMemo(() => {
    const now = new Date()
    return rows
      .map((r) => {
        const status = String(r.status || '').toLowerCase()
        const holdExpiresAtDate = toDate(r.holdExpiresAt)
        const startTimeDate = toDate(r.startTime)
        const endTimeDate = toDate(r.endTime)
        const isHoldActive = status === 'hold' && holdExpiresAtDate && holdExpiresAtDate > now
        const remainingMs = isHoldActive ? holdExpiresAtDate.getTime() - now.getTime() : 0
        return {
          ...r,
          _status: status,
          _holdExpiresAt: holdExpiresAtDate,
          _startTime: startTimeDate,
          _endTime: endTimeDate,
          _isHoldActive: isHoldActive,
          _remainingMs: remainingMs,
        }
      })
      .filter((r) => r._status === 'hold')
      .sort((a, b) => (b._holdExpiresAt?.getTime?.() || 0) - (a._holdExpiresAt?.getTime?.() || 0))
  }, [rows])

  useEffect(() => {
    const now = new Date()
    for (const r of pendingRows) {
      if (!r.id) continue
      if (r._status !== 'hold') continue
      if (r._holdExpiresAt && r._holdExpiresAt <= now) {
        expireReservation({ db, reservationId: r.id }).catch(() => {})
      }
    }
  }, [pendingRows])

  async function onConfirm(r) {
    setError('')
    setProcessingId(r.id)
    try {
      await confirmHoldReservation({ db, reservationId: r.id })
    } catch (e) {
      setError(e?.message || 'Failed to confirm reservation')
    } finally {
      setProcessingId('')
    }
  }

  async function onReject(r) {
    const ok = window.confirm('Reject this pending reservation?')
    if (!ok) return

    setError('')
    setProcessingId(r.id)
    try {
      await cancelReservation({ db, reservationId: r.id, tableId: r.tableId, slotKeys: r.slotKeys })
    } catch (e) {
      setError(e?.message || 'Failed to reject reservation')
    } finally {
      setProcessingId('')
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div>
            <h2 className="pageTitle">Admin • Reservations</h2>
            <div className="muted">Confirm pending reservations within 5 minutes</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {loading ? <div className="muted">Loading…</div> : null}
          </div>
        </div>

        {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      </div>

      <div className="card">
        <div className="cardHeader">
          <div>
            <div style={{ fontWeight: 700 }}>Pending approvals</div>
            <div className="muted">Total: {pendingRows.length}</div>
          </div>
        </div>

        <div className="stack" style={{ marginTop: 12 }}>
          {pendingRows.length === 0 && !loading ? <div className="muted">No pending reservations.</div> : null}

          {pendingRows.map((r) => {
            const canAct = Boolean(r._isHoldActive)
            const isBusy = processingId === r.id

            return (
              <div key={r.id} className="rowCard">
                <div>
                  <div className="rowCard__title">Table {r.tableNumber ?? r.tableId}</div>
                  <div className="muted">Customer: {r.customerName || '—'} • {r.customerPhone || '—'} • {r.customerEmail || '—'}</div>
                  <div className="muted">Party size: {r.partySize ?? '—'} (Seats: {r.tableSeats ?? '—'})</div>
                  <div className="muted">Time: {r._startTime ? r._startTime.toLocaleString() : '—'} → {r._endTime ? r._endTime.toLocaleString() : '—'}</div>
                  <div className="muted">Expires in: <b>{canAct ? formatCountdown(r._remainingMs) : 'Expired'}</b></div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={!canAct || isBusy}
                    onClick={() => onConfirm(r)}
                  >
                    {isBusy ? 'Working…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={isBusy}
                    onClick={() => onReject(r)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
