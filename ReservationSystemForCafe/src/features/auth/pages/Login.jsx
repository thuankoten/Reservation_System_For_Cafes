import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../../../shared/firebase'
import { useAuth } from '../AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const derivedMode = location.pathname.endsWith('/signup') ? 'signup' : 'login'
  const [mode, setMode] = useState(derivedMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = useMemo(() => {
    const from = location.state?.from?.pathname
    return from || '/'
  }, [location.state])

  if (user) {
    navigate(redirectTo, { replace: true })
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
      }
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err?.message || 'Auth error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <h2 className="pageTitle">{mode === 'login' ? 'Login' : 'Sign-up'}</h2>
      <div className="muted">Use your email & password</div>

      <form onSubmit={onSubmit} className="stack" style={{ marginTop: 12 }}>
        <label className="field">
          <div className="field__label">Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="input" />
        </label>

        <label className="field">
          <div className="field__label">Password</div>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="input" />
        </label>

        {error ? <div className="error">{error}</div> : null}

        <button disabled={submitting} type="submit" className="btn btn--primary">
          {submitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
        </button>

        <button
          type="button"
          onClick={() => navigate(mode === 'login' ? '/auth/signup' : '/auth/login')}
          className="btn"
        >
          {mode === 'login' ? 'Go to Sign-up' : 'Go to Login'}
        </button>
      </form>
    </div>
  )
}
