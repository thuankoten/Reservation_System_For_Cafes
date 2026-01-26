import { useMemo } from 'react'

export default function TableMap({
  tables,
  selectedTableId,
  reservationByTableId,
  normalizedStatus,
  statusSymbol,
  onTableClick,
  onTableContextMenu,
  onBackgroundClick,
}) {
  const mapCount = tables.length
  const mapCols = useMemo(() => {
    if (mapCount <= 1) return 1
    if (mapCount <= 3) return mapCount
    if (mapCount <= 6) return 3
    if (mapCount === 9) return 3
    return 4
  }, [mapCount])

  const mapRows = Math.max(1, Math.ceil(mapCount / mapCols))

  return (
    <div
      className="floorPlan"
      role="region"
      aria-label="Floor plan"
      style={{ '--cols': mapCols, '--rows': mapRows }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onBackgroundClick) onBackgroundClick(e)
      }}
    >
      {tables.map((t) => {
        const status = normalizedStatus(t.status)
        const hasReservation = reservationByTableId?.has?.(t.id)
        const effectiveStatus = hasReservation ? 'reserved' : status
        const isActive = t.id === selectedTableId

        return (
          <button
            key={t.id}
            type="button"
            className={`tableItem ${isActive ? 'tableItem--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              if (onTableClick) onTableClick(t, e)
            }}
            onContextMenu={(e) => {
              if (!onTableContextMenu) return
              e.preventDefault()
              e.stopPropagation()
              onTableContextMenu(t, e)
            }}
          >
            <div className={`tableSquare tableSquare--${effectiveStatus}`}>
              <div className={`tableSquare__icon tableSquare__icon--${effectiveStatus}`}>
                <span className="tableSquare__symbol">{statusSymbol(effectiveStatus)}</span>
              </div>
              <div className={`tableSquare__status tableSquare__status--${effectiveStatus}`}>{effectiveStatus}</div>
            </div>
            <div className="tableNumber">{t.number}</div>
          </button>
        )
      })}
    </div>
  )
}
