import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { db } from '../../../shared/firebase'
import { auth } from '../../../shared/firebase'
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
  const { user, refreshUser } = useAuth()
  const [history, setHistory] = useState([])
  const [namePromptOpen, setNamePromptOpen] = useState(false)
  const [pendingName, setPendingName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Time-based greeting (Morning, Afternoon, Evening)
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Wishing you a wonderful morning!"
    if (hour < 18) return "Have a relaxing afternoon!"
    return "Have a warm evening!"
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

  useEffect(() => {
    const isAnon = Boolean(user?.isAnonymous)
    const hasName = Boolean(String(user?.displayName || '').trim())
    if (isAnon && !hasName) {
      setNamePromptOpen(true)
    } else {
      setNamePromptOpen(false)
    }
  }, [user?.displayName, user?.isAnonymous])

  async function saveAnonymousName() {
    const name = String(pendingName || '').trim()
    if (!name) return
    if (!auth.currentUser) return
    setSavingName(true)
    try {
      await updateProfile(auth.currentUser, { displayName: name })
      await refreshUser?.()
      setNamePromptOpen(false)
    } finally {
      setSavingName(false)
    }
  }

  const getBadgeProps = (status) => {
    const s = String(status || '').toLowerCase()
    if (s === 'confirmed' || s === 'approved') return { tone: 'success', text: 'Confirmed' }
    if (s === 'cancelled') return { tone: 'danger', text: 'Cancelled' }
    return { tone: 'neutral', text: 'Pending' }
  }

  return (
    <div className="stack" style={{ padding: '20px' }}>
      {namePromptOpen ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNamePromptOpen(false)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            className="card"
            style={{ width: 'min(480px, 100%)', padding: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pageTitle" style={{ marginBottom: 6 }}>
              How can I call you?
            </div>

            <label className="field">
              <div className="field__label">Display name</div>
              <input
                className="input"
                value={pendingName}
                onChange={(e) => setPendingName(e.target.value)}
                placeholder=""
                autoFocus
              />
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="btn" onClick={() => setNamePromptOpen(false)} disabled={savingName}>
                Later
              </button>
              <button
                type="button"
                className="brandButton"
                onClick={saveAnonymousName}
                disabled={savingName || !String(pendingName || '').trim()}
              >
                {savingName ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Welcome banner */}
      <div className={styles.welcomeBanner}>
        <div className={styles.bannerContent}>
          <h2>Hello, {user?.displayName || 'Guest'}! ☕</h2>
          <p>{getGreeting()}</p>
          <p style={{ opacity: 0.8, fontSize: '0.9rem', marginTop: '5px' }}>
            Where would you like to enjoy your coffee today?
          </p>
          <div className={styles.buttonGroup}>
            <button 
              className={styles.btnPrimary} 
              onClick={() => navigate('/dashboard/reservations')} 
            >
              🗓️ Book a table
            </button>
          </div>
        </div>
      </div>

      {/* Cafe info & contact */}
      <div className={styles.infoCard}>
        <div className={styles.cardHeader}>
          <h3 style={{ margin: 0 }}>Cafe Information</h3>
          <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '5px' }}>
            Address & Contact
          </p>
        </div>
        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>Address</div>
            <div className={styles.infoValue}>123 To Ky, District 12, Ho Chi Minh City</div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>Phone</div>
            <div className={styles.infoValue}><a href="tel:+84123456789" className={styles.infoLink}>0123 456 789</a></div>
          </div>
          <div className={styles.infoRow}>
            <div className={styles.infoLabel}>Opening hours</div>
            <div className={styles.infoValue}>08:00 - 23:00 (daily)</div>
          </div>
        </div>
      </div>

      {/* Cafe menu */}
      <div className={styles.menuCard}>
        <div className={styles.cardHeader}>
          <h3 style={{ margin: 0 }}>Menu</h3>
        </div>
        <div className={styles.menuImageWrap}>
          <img
            className={styles.menuImage}
            src="/menu.jpg"
            alt="Cafe Menu"
            loading="lazy"
          />
        </div>
      </div>

      {/* Recent activity card */}
      <div className={styles.historyCard}>
        <div className={styles.cardHeader}>
          <h3 style={{ margin: 0 }}>Your Recent Visits</h3>
          <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '5px' }}>
            Latest activity
          </p>
        </div>
        
        
        <div className={styles.historyTableContainer}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>Table</th>
                <th>Booked At</th>
                <th style={{ textAlign: 'right' }}>Status</th>
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
                No history yet. Book your first table to enjoy perks!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}