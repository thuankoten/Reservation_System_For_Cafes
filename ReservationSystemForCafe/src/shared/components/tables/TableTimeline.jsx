import { useMemo } from 'react'
import { formatISODate, minutesToTimeLabel, TIMELINE_CONFIG } from '../../utils/timeline'

function minutesFromMidnight(d) {
  if (!d) return NaN
  return d.getHours() * 60 + d.getMinutes()
}

export default function TableTimeline({ tables, reservations, isoDate, onChangeIsoDate, onOpenReservation, occupiedTableIds }) {
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

        <div className="ganttBody">
          {tables.map((t) => {
            const bars = timelineBarsByTableId.get(t.id) || []
            const isOccupied = occupiedTableIds instanceof Set ? occupiedTableIds.has(t.id) : false

            return (
              <div key={t.id} className="ganttRow">
                <div className="ganttLabelCell">Table {t.number ?? '—'}</div>
                <div className="ganttTrack" aria-label={`Timeline for table ${t.number ?? t.id}`}>
                  {isOccupied ? (
                    <div
                      className="ganttBar ganttBar--occupied"
                      style={{ left: 0, width: slotCount * cellWidthPx, opacity: 0.25 }}
                      title={`Table ${t.number ?? t.id} • Occupied`}
                      aria-hidden="true"
                    />
                  ) : null}
                  {bars.map((r) => {
                    const startM = minutesFromMidnight(r.startTimeDate)
                    const endM = minutesFromMidnight(r.endTimeDate)
                    const startIdx = toSlotIndex(startM)
                    const endIdx = toSlotEndIndex(endM)
                    if (startIdx == null || endIdx == null) return null
                    const safeStart = Math.max(0, Math.min(slotCount, startIdx))
                    const safeEnd = Math.max(0, Math.min(slotCount, endIdx))
                    const left = safeStart * cellWidthPx
                    const width = Math.max(cellWidthPx, (safeEnd - safeStart) * cellWidthPx)
                    const kind = String(r._status || '').toLowerCase() === 'hold' ? 'hold' : 'confirmed'
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
