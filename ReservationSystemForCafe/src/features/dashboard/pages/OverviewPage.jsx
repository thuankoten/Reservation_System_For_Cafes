import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../../shared/firebase'
import { useAuth } from '../../auth/useAuth'
import styles from './OverviewPage.module.css'

function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

function toDate(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate()
  try { return new Date(v) } catch { return null }
}

function formatDateTime(d) {
  if (!(d instanceof Date)) return '—'
  if (Number.isNaN(d.getTime())) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(d)
  } catch {
    return d.toLocaleString?.() || String(d)
  }
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [history, setHistory] = useState([])
  
  // Hàm lấy lời chào theo thời gian (Sáng, Chiều, Tối)
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Chúc bạn một buổi sáng tốt lành!"
    if (hour < 18) return "Chúc bạn một buổi chiều thư giãn!"
    if (hour >= 18) return "Chúc bạn một buổi tối ấm áp!"
    return "Chúc bạn một buổi tối ấm áp!"
  }

  useEffect(() => {
    if (!user?.uid) return
    const q = query(
      collection(db, 'reservations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    )
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user?.uid])

  const getBadgeProps = (status) => {
    const s = String(status || '').toLowerCase()
    if (s === 'confirmed' || s === 'approved') return { tone: 'success', text: 'Thành công' }
    if (s === 'cancelled') return { tone: 'danger', text: 'Đã hủy' }
    return { tone: 'neutral', text: 'Đang xử lý' }
  }

  return (
    <div className="stack" style={{ padding: '20px' }}>
      
      {/* BANNER CHÀO MỪNG - TIỆN ÍCH CHO KHÁCH */}
      <div className={styles.welcomeBanner}>
        <div className={styles.bannerContent}>
          <h2>Xin chào, {user?.displayName || 'Quý khách'}! ☕</h2>
          <p>{getGreeting()}</p>
          <p style={{ opacity: 0.8, fontSize: '0.9rem', marginTop: '5px' }}>
            Hôm nay bạn muốn thưởng thức Café tại góc bàn nào?
          </p>
          <div className={styles.buttonGroup}>
            <button 
              className={styles.btnPrimary} 
              onClick={() => navigate('/dashboard/reservations')} 
            >
              🗓️ ĐẶT BÀN NGAY 
            </button>
          </div>
        </div>
      </div>

      {/* THÔNG TIN QUÁN & LIÊN HỆ */}
      <div className={styles.infoCard}>
        <div className={styles.cardHeader}>
          <h3 style={{ margin: 0 }}>Thông tin quán</h3>
          <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '5px' }}>
            Địa chỉ & liên hệ
          </p>
        </div>
        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>Địa chỉ</div>
            <div className={styles.infoValue}>123 Tô Ký, Quận 12, TP.HCM</div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>Số điện thoại</div>
            <div className={styles.infoValue}><a href="tel:+84123456789" className={styles.infoLink}>0123 456 789</a></div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>Giờ mở cửa</div>
            <div className={styles.infoValue}>08:00 - 23:00 (hằng ngày)</div>
          </div>
        </div>
      </div>

      {/* MENU CỦA QUÁN */}
      <div className={styles.menuCard}>
        <div className={styles.cardHeader}>
          <h3 style={{ margin: 0 }}>Menu</h3>
        </div>
        <div className={styles.menuImageWrap}>
          <img
            className={styles.menuImage}
            src="/menu.jpg"
            alt="Menu của quán"
            loading="lazy"
          />
        </div>
      </div>

      {/* THẺ LỊCH SỬ HOẠT ĐỘNG */}
      <div className={styles.historyCard}>
        <div className={styles.cardHeader}>
          <h3 style={{ margin: 0 }}>Chuyến thăm gần đây của bạn</h3>
          <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '5px' }}>
            Hoạt động mới nhất
          </p>
        </div>
        
        
        <div className={styles.historyTableContainer}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>Bàn</th>
                <th>Ngày đặt</th>
                <th style={{ textAlign: 'right' }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td style={{ fontWeight: 'bold', color: '#6e4e37' }}>
                    {h.tableNumber ? `Table ${h.tableNumber}` : (h.tableId ? `Table ${h.tableId}` : 'Table —')}
                  </td>
                  <td>{formatDateTime(toDate(h.createdAt))}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Badge tone={getBadgeProps(h.status).tone}>
                      {getBadgeProps(h.status).text}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          
          {history.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ color: '#999', fontSize: '0.9rem' }}>
                Chưa có lịch sử. Hãy đặt bàn đầu tiên để nhận ưu đãi nhé!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}