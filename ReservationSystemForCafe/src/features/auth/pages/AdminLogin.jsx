import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../../../shared/firebase'
import { getUserById } from '../../../shared/services/users'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleEmailLogin(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const uid = cred.user.uid
      const doc = await getUserById(uid)
      const role = doc?.role
      if (role === 'admin' || role === 'system-admin') {
        navigate('/admin/dashboard', { replace: true })
        return
      }
      // not permitted
      await signOut(auth)
      setError('Account does not have admin access')
    } catch (err) {
      setError(err?.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setSubmitting(true)
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider())
      const uid = cred.user.uid
      const doc = await getUserById(uid)
      const role = doc?.role
      if (role === 'admin' || role === 'system-admin') {
        navigate('/admin/dashboard', { replace: true })
        return
      }
      await signOut(auth)
      setError('Account does not have admin access')
    } catch (err) {
      setError(err?.message || 'Google sign-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ghAuth">
      <div className="ghAuth__header">
        <div className="ghAuth__logo" aria-hidden="true">
          A
        </div>
        <h1 className="ghAuth__title">Admin Sign In</h1>
      </div>

      <div className="ghAuth__panel">
        <form onSubmit={handleEmailLogin} className="ghForm" noValidate>
          <label className="ghField">
            <div className="ghField__label">Email address</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
              required
              className="ghInput"
            />
          </label>

          <label className="ghField">
            <div className="ghField__label">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
              className="ghInput"
            />
          </label>

          {error ? <div className="error">{error}</div> : null}

          <button disabled={submitting} type="submit" className="ghPrimaryButton">
            {submitting ? 'Please wait…' : 'Sign in'}
          </button>
        </form>

        <div className="ghDivider" role="separator" aria-label="or">
          <span className="ghDivider__text">or</span>
        </div>

        <div className="ghProviders" aria-label="Sign in providers">
          <button className="ghProviderButton" disabled={submitting} onClick={handleGoogle} type="button">
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  )
}
