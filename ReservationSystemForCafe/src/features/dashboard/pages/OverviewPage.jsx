import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../../shared/firebase'
import { useAuth } from '../../auth/useAuth'
import styles from './OverviewPage.module.css'
import toast from 'react-hot-toast'

// Helper: Hiển thị nhãn trạng thái
function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

// Helper: Định dạng ngày tháng
function formatWhen(date) {
  try {
    if (!date) return '—'
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(date)
  } catch { return String(date) }
}

function toDate(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  try { return new Date(v) } catch { return null }
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [availableCount, setAvailableCount] = useState(null)
  const [totalCount, setTotalCount] = useState(null)
  const [currentReservation, setCurrentReservation] = useState(null)
  const [history, setHistory] = useState([])
  const [loadingTables, setLoadingTables] = useState(true)

  // 1. Theo dõi số lượng bàn trống realtime
  useEffect(() => {
    const qTables = query(collection(db, 'tables'), orderBy('number', 'asc'))
    return onSnapshot(qTables, (snap) => {
      const rows = snap.docs.map((d) => d.data())
      setAvailableCount(rows.filter((t) => (t.status || 'available') === 'available').length)
      setTotalCount(rows.length)
      setLoadingTables(false)
    })
  }, [])

  // 2. Theo dõi lịch sử và hiện thông báo khi có đơn mới
  useEffect(() => {
    if (!user?.uid) return

    const qRecent = query(
      collection(db, 'reservations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    )

    return onSnapshot(qRecent, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      
      // Nếu có đơn mới (số lượng đơn tăng lên)
      if (history.length > 0 && rows.length > history.length) {
        toast.success('Đặt bàn thành công! Hẹn gặp bạn tại Aroma ☕');
      }

      const now = new Date()
      const active = rows.find(r => r.status === 'confirmed' || (r.status === 'hold' && toDate(r.holdExpiresAt) > now))
      
      setCurrentReservation(active || null)
      setHistory(rows)
    })
  }, [user?.uid, history.length])

  const getBadgeProps = (status) => {
    const s = String(status || '').toLowerCase()
    if (s === 'confirmed' || s === 'approved') return { tone: 'success', text: 'Confirmed' }
    if (s === 'hold') return { tone: 'neutral', text: 'Hold' }
    if (s === 'cancelled') return { tone: 'danger', text: 'Cancelled' }
    return { tone: 'neutral', text: s || '—' }
  }

  return (
    <div className="stack">
      <div className="overviewGrid">
        {/* Card Trạng thái bàn */}
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
              <div className="bigNumber">{loadingTables ? '—' : availableCount}</div>
              <div className="muted">{availableCount}/{totalCount} tables available</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'end' }}>
              <Link className="btn" to="/dashboard/floor">View floor</Link>
              <button className="btn btn--primary" onClick={() => navigate('/dashboard/reservation')}>Book now</button>
            </div>
          </div>
        </div>

        {/* Card Đơn hiện tại */}
        <div className="card">
          <div className="cardHeader">
            <div style={{ fontWeight: 700 }}>Current reservation</div>
            <Badge tone="neutral">Signed in</Badge>
          </div>
          {!currentReservation ? (
            <div className="muted" style={{ marginTop: 12 }}>No active reservation found.</div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div className="rowCard" style={{ padding: 12 }}>
                <div>
                  <div className="rowCard__title">Table: {currentReservation.tableId?.slice(0, 8)}...</div>
                  <div className="muted">{formatWhen(toDate(currentReservation.startTime))}</div>
                </div>
                <Badge tone={getBadgeProps(currentReservation.status).tone}>
                  {getBadgeProps(currentReservation.status).text}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bảng Lịch sử của Minh */}
      <div className={`card ${styles.historyCard}`}>
        <div className="cardHeader">
          <div style={{ fontWeight: 700 }}>Recent History</div>
          <div className="muted">Last 10 activities</div>
        </div>
        <div className={styles.historyTableContainer}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Table ID</th>
                <th>Party</th>
                <th className={styles.statusAlign}>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{formatWhen(toDate(h.startTime))}</td>
                  <td style={{ fontSize: '0.75rem', color: '#666' }}>{h.tableId?.slice(0, 12)}...</td>
                  <td>{h.partySize} người</td>
                  <td className={styles.statusAlign}>
                    <Badge tone={getBadgeProps(h.status).tone}>{getBadgeProps(h.status).text}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && (
            <div className="muted" style={{ textAlign: 'center', padding: 20 }}>No booking history found.</div>
          )}
        </div>
      </div>
    </div>
  )
}