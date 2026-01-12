import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../../../shared/firebase'
import { useAuth } from '../AuthContext.jsx'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const redirectTo = useMemo(() => {
    const from = location.state?.from?.pathname
    return from || '/dashboard/overview'
  }, [location.state])

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true })
  }, [navigate, redirectTo, user])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      await sendPasswordResetEmail(auth, email)
      setSuccess('Password reset email sent. Please check your inbox.')
    } catch (err) {
      setError(err?.message || 'Failed to send reset email')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <h2 className="pageTitle">Forgot password</h2>
      <div className="muted">We will send you a password reset email.</div>

      <form onSubmit={onSubmit} className="stack" style={{ marginTop: 12 }}>
        <label className="field">
          <div className="field__label">Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="input" />
        </label>

        {error ? <div className="error">{error}</div> : null}
        {success ? <div className="muted">{success}</div> : null}

        <button disabled={submitting} type="submit" className="btn btn--primary">
          {submitting ? 'Sending…' : 'Send reset email'}
        </button>

        <Link className="btn" to="/auth/login">
          Back to Login
        </Link>
      </form>
    </div>
  )
}
