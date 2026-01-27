import React from 'react'

export default function ReservationPanel({
  title,
  subtitle,
  headerActions,
  table,
  floorLabel,
  statusLabel,
  placementLabel,
  emptyText,
  extraCard,
  showImage = true,
  imageUrl,
  imageError,
  onOpenImage,
  onImageError,
  onRetryImage,
}) {
  return (
    <section className="reservationPanel" aria-label={title || 'Reservation Details'}>
      <header className="reservationPanel__header">
        <div>
          <div className="reservationPanel__title">{title}</div>
          <div className="reservationPanel__subtitle">{subtitle}</div>
        </div>

        <div className="reservationPanel__actions">{headerActions}</div>
      </header>

      {!table ? (
        <div className="reservationPanel__empty">{emptyText || 'Select a table to view details.'}</div>
      ) : (
        <div className="reservationPanel__body">
          <div className="kv">
            {'number' in table ? (
              <div className="kv__row">
                <div className="kv__k">Table</div>
                <div className="kv__v">{table.number}</div>
              </div>
            ) : null}

            {floorLabel ? (
              <div className="kv__row">
                <div className="kv__k">Floor</div>
                <div className="kv__v">{floorLabel}</div>
              </div>
            ) : null}

            {'seats' in table ? (
              <div className="kv__row">
                <div className="kv__k">Seats</div>
                <div className="kv__v">{table.seats || '—'}</div>
              </div>
            ) : null}

            {statusLabel ? (
              <div className="kv__row">
                <div className="kv__k">Status</div>
                <div className="kv__v">{statusLabel}</div>
              </div>
            ) : null}

            {placementLabel ? (
              <div className="kv__row">
                <div className="kv__k">Placement</div>
                <div className="kv__v">{placementLabel}</div>
              </div>
            ) : null}
          </div>

          {extraCard}

          {showImage ? (
            imageUrl ? (
              imageError ? (
                <div className="rowCard" style={{ marginTop: 12, padding: 12 }}>
                  <div>
                    <div className="rowCard__title">Image failed to load</div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      The image URL may be invalid, private, expired, or blocked by the host.
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <a className="btn" href={imageUrl} target="_blank" rel="noreferrer">
                        Open image
                      </a>
                      {onRetryImage ? (
                        <button type="button" className="btn" onClick={onRetryImage}>
                          Retry
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="reservationPanel__thumbBtn"
                  onClick={() => onOpenImage?.(imageUrl)}
                  aria-label="View table image"
                >
                  <img
                    className="reservationPanel__thumb"
                    src={imageUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => onImageError?.()}
                  />
                </button>
              )
            ) : (
              <div className="muted" style={{ marginTop: 12 }}>
                No image.
              </div>
            )
          ) : null}
        </div>
      )}
    </section>
  )
}
