import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../../shared/firebase'
import { useAuth } from '../../auth/AuthContext.jsx'
import { Link } from 'react-router-dom'

export default function FloorPage() {
  const { user } = useAuth()
  const [tables, setTables] = useState([])

  useEffect(() => {
    if (!user) return
    const qTables = query(collection(db, 'tables'), orderBy('number', 'asc'))
    const unsub = onSnapshot(qTables, (snap) => {
      setTables(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })

    return () => unsub()
  }, [user])

  if (!user) {
    return (
      <div className="card">
        <h2 className="pageTitle">Floor</h2>
        <div className="muted" style={{ marginTop: 6 }}>
          Please login to view realtime tables.
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn--primary" to="/auth/login">
            Login
          </Link>
          <Link className="btn" to="/auth/signup">
            Sign-up
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="pageTitle">Floor</h2>
      <div className="muted">Realtime view of tables</div>

      <div className="grid">
        {tables.map((t) => (
          <div key={t.id} className="tile">
            <div className="tile__title">Table {t.number}</div>
            <div className="tile__meta">Seats: {t.seats || '?'}</div>
            <div className="tile__meta">Status: {t.status || 'available'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
