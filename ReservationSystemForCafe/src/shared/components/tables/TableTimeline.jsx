import { useMemo } from 'react'
import { formatISODate, minutesToTimeLabel, TIMELINE_CONFIG } from '../../utils/timeline'

function minutesFromMidnight(d) {
  if (!d) return NaN
  return d.getHours() * 60 + d.getMinutes()
}

function toDate(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  try { return new Date(v) } catch { return null }
}

export default function TableTimeline({ tables, reservations, isoDate, onChangeIsoDate, onOpenReservation, occupiedTableIds, nowOffsetMinutes = 0 }) {
  const timelineReservationsForDay = useMemo(() => {
    return reservations.filter((r) => {
      if (!r?.startTimeDate) return false
      return formatISODate(r.startTimeDate) === isoDate
    })
  }, [isoDate, reservations])

  const timelineBarsByTableId = useMemo(() => {
    const map = new Map()
    for (const r of timelineReservationsForDay) {
      if (!r.tableId) continue
      const list = map.get(r.tableId) || []
      list.push(r)
      map.set(r.tableId, list)
    }
    for (const [id, list] of map.entries()) {
      map.set(
        id,
        list.slice().sort((a, b) => (a.startTimeDate?.getTime?.() || 0) - (b.startTimeDate?.getTime?.() || 0))
      )
    }
    return map
  }, [timelineReservationsForDay])

  const walkInBarsByTableId = useMemo(() => {
    const map = new Map()
    for (const t of tables) {
      const since = toDate(t.manualOccupiedSince)
      if (!since) continue
      const iso = formatISODate(since)
      if (iso !== isoDate) continue
      // If manualOccupiedUntil exists, use it; otherwise, extend to end of day
      const until = toDate(t.manualOccupiedUntil)
      const until2359 = new Date(since.getFullYear(), since.getMonth(), since.getDate(), 23, 59, 59)
      // If until exists and is after since, use it; otherwise use end of day
      const endTime = until && until.getTime() > since.getTime() ? until : until2359
      const walkInObj = {
        id: `walk-in-${t.id}`,
        tableId: t.id,
        _status: 'manual',
        startTimeDate: since,
        endTimeDate: endTime,
      }
      map.set(t.id, [walkInObj])
    }
    return map
  }, [tables, isoDate, nowOffsetMinutes])

  const slotMinutes = TIMELINE_CONFIG.stepMinutes
  const openMinutes = TIMELINE_CONFIG.openMinutes
  const closeMinutes = TIMELINE_CONFIG.closeMinutes

  const slotStarts = useMemo(() => {
    const out = []
    for (let m = openMinutes; m <= closeMinutes - slotMinutes; m += slotMinutes) out.push(m)
    return out
  }, [closeMinutes, openMinutes, slotMinutes])

  const slotCount = slotStarts.length
  const cellWidthPx = 64

  const toSlotIndex = (minutes) => {
    if (!Number.isFinite(minutes)) return null
    const clamped = Math.max(openMinutes, Math.min(closeMinutes, minutes))
    return Math.floor((clamped - openMinutes) / slotMinutes)
  }

  const toSlotEndIndex = (minutes) => {
    if (!Number.isFinite(minutes)) return null
    const clamped = Math.max(openMinutes, Math.min(closeMinutes, minutes))
    return Math.ceil((clamped - openMinutes) / slotMinutes)
  }

  return (
    <div className="tablesSection" style={{ gridColumn: '1 / -1' }}>
      <div className="tablesSection__title">TimeLine</div>

      <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="muted" style={{ fontWeight: 700 }}>Date</div>
        <input
          type="date"
          className="input"
          value={isoDate}
          onChange={(e) => onChangeIsoDate && onChangeIsoDate(e.target.value)}
          style={{ maxWidth: 180 }}
        />
        <div className="ganttLegend" aria-label="Timeline status legend" style={{ marginLeft: 12 }}>
          <div className="ganttLegend__item"><span className="ganttLegend__swatch swatch--confirmed" />Confirmed</div>
          <div className="ganttLegend__item"><span className="ganttLegend__swatch swatch--hold" />Pending (Hold)</div>
          <div className="ganttLegend__item"><span className="ganttLegend__swatch swatch--occupied" />Occupied</div>
          <div className="ganttLegend__item"><span className="ganttLegend__swatch swatch--completed" />Completed</div>
          <div className="ganttLegend__item"><span className="ganttLegend__swatch swatch--expired" />Expired</div>
          <div className="ganttLegend__item"><span className="ganttLegend__swatch swatch--manual" />Walk-in</div>
        </div>
      </div>

      {timelineReservationsForDay.length === 0 ? <div className="muted" style={{ marginTop: 12 }}>No active reservations.</div> : null}

      <div className="ganttWrap" style={{ marginTop: 12, ['--slotCount']: slotCount, ['--cellW']: `${cellWidthPx}px` }}>
        <div className="ganttHeader">
          <div className="ganttLabelCell">Table</div>
          <div className="ganttTimeAxis">
            {slotStarts.map((m) => (
              <div key={m} className="ganttTick">{minutesToTimeLabel(m)}</div>
            ))}
          </div>
        </div>

        <div className="ganttBody" style={{ position: 'relative' }}>
          {tables.map((t) => {
            const bars = timelineBarsByTableId.get(t.id) || []
            const walkInBars = walkInBarsByTableId.get(t.id) || []
            const allBars = [...bars, ...walkInBars]
            const isOccupied = occupiedTableIds instanceof Set ? occupiedTableIds.has(t.id) : false
            const now = new Date(Date.now() + (Number(nowOffsetMinutes) || 0) * 60 * 1000)

            return (
              <div key={t.id} className="ganttRow">
                <div className="ganttLabelCell">Table {t.number ?? '—'}</div>
                <div className="ganttTrack" aria-label={`Timeline for table ${t.number ?? t.id}`} style={{ position: 'relative' }}>
                  {(() => {
                    const todayIso = formatISODate(new Date())
                    if (isoDate !== todayIso) return null
                    const nowM = minutesFromMidnight(now)
                    if (!Number.isFinite(nowM)) return null
                    const clampedM = Math.max(openMinutes, Math.min(closeMinutes, nowM))
                    const leftPx = Math.max(0, ((clampedM - openMinutes) / slotMinutes) * cellWidthPx)
                    return (
                      <div
                        aria-hidden="true"
                        title="Now"
                        style={{ position: 'absolute', left: leftPx, top: 0, bottom: 0, width: 2, background: 'red', opacity: 0.6, pointerEvents: 'none' }}
                      />
                    )
                  })()}
                  {isOccupied ? (
                    <div
                      className="ganttBar ganttBar--occupied"
                      style={{ left: 0, width: slotCount * cellWidthPx, opacity: 0.25 }}
                      title={`Table ${t.number ?? t.id} • Occupied`}
                      aria-hidden="true"
                    />
                  ) : null}
                  {allBars.map((r) => {
                    const startM = minutesFromMidnight(r.startTimeDate)
                    const endM = minutesFromMidnight(r.endTimeDate)
                    const startIdx = toSlotIndex(startM)
                    const endIdx = toSlotEndIndex(endM)
                    if (startIdx == null || endIdx == null) return null
                    const safeStart = Math.max(0, Math.min(slotCount, startIdx))
                    const safeEnd = Math.max(0, Math.min(slotCount, endIdx))
                    const left = safeStart * cellWidthPx
                    const width = Math.max(cellWidthPx, (safeEnd - safeStart) * cellWidthPx)
                    const baseStatus = String(r._status || '').toLowerCase()
                    const kind = baseStatus === 'hold'
                      ? 'hold'
                      : baseStatus === 'occupied'
                        ? 'occupied'
                        : baseStatus === 'completed'
                          ? 'completed'
                          : baseStatus === 'expired'
                            ? 'expired'
                            : baseStatus === 'manual'
                              ? 'manual'
                              : 'confirmed'
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`ganttBar ganttBar--${kind}`}
                        style={{ left, width, cursor: onOpenReservation ? 'pointer' : 'default' }}
                        title={`Table ${t.number ?? t.id} • ${minutesToTimeLabel(startM)} - ${minutesToTimeLabel(endM)}`}
                        onClick={() => onOpenReservation && onOpenReservation(r.id)}
                        aria-label={`Reservation ${r.id} ${minutesToTimeLabel(startM)} - ${minutesToTimeLabel(endM)}`}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
