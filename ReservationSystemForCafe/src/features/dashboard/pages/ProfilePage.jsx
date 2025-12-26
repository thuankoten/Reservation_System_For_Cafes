import { useAuth } from '../../auth/AuthContext.jsx'
import { Link } from 'react-router-dom'

export default function ProfilePage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="card">
        <h2 className="pageTitle">Profile</h2>
        <div className="muted" style={{ marginTop: 6 }}>
          Please login to view your profile.
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
      <h2 className="pageTitle">Profile</h2>
      <div className="muted">Account information</div>

      <div className="kv">
        <div className="kv__row">
          <div className="kv__k">Email</div>
          <div className="kv__v">{user?.email}</div>
        </div>
        <div className="kv__row">
          <div className="kv__k">UID</div>
          <div className="kv__v" style={{ wordBreak: 'break-all' }}>
            {user?.uid}
          </div>
        </div>
      </div>
    </div>
  )
}
