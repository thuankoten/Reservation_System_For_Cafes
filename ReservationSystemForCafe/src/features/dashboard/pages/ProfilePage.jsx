import { useAuth } from '../../auth/AuthContext.jsx'

export default function ProfilePage() {
  const { user } = useAuth()

  return (
    <div className="card">
      <h2 className="pageTitle">Profile</h2>
      <div className="muted">Account information</div>

      {!user ? (
        <div className="muted" style={{ marginTop: 10 }}>
          You are browsing as guest.
        </div>
      ) : null}

      <div className="kv">
        <div className="kv__row">
          <div className="kv__k">Email</div>
          <div className="kv__v">{user?.email || '—'}</div>
        </div>
        <div className="kv__row">
          <div className="kv__k">UID</div>
          <div className="kv__v" style={{ wordBreak: 'break-all' }}>
            {user?.uid || '—'}
          </div>
        </div>
      </div>
    </div>
  )
}
