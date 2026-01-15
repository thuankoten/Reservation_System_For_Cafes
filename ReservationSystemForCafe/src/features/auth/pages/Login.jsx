import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  GoogleAuthProvider,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '../../../shared/firebase'
import { useAuth } from '../AuthContext.jsx'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const redirectTo = useMemo(() => {
    const from = location.state?.from?.pathname
    return from || '/dashboard/overview'
  }, [location.state])

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true })
  }, [navigate, redirectTo, user])

  async function onLoginWithEmail(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err?.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function onContinueWithGoogle() {
    setError('')
    setSubmitting(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err?.message || 'Google sign-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function onContinueAnonymously() {
    setError('')
    setSubmitting(true)
    try {
      await signInAnonymously(auth)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err?.message || 'Anonymous sign-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="ghAuth">
      <div className="ghAuth__header">
        <div className="ghAuth__logo" aria-hidden="true">
          C
        </div>
        <h1 className="ghAuth__title">Sign in to Cafe</h1>
      </div>

      <div className="ghAuth__panel">
        <form onSubmit={onLoginWithEmail} className="ghForm" noValidate>
          <label className="ghField">
            <div className="ghField__label">Username or email address</div>
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
            <div className="ghField__labelRow">
              <div className="ghField__label">Password</div>
              <Link className="ghLink" to="/auth/forgot-password">
                Forgot password?
              </Link>
            </div>
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
          <button className="ghProviderButton" disabled={submitting} onClick={onContinueWithGoogle} type="button">
            Continue with Google
          </button>
          <button className="ghProviderButton" disabled={submitting} onClick={onContinueAnonymously} type="button">
            Continue as Guest
          </button>
        </div>
      </div>

      <div className="ghAuth__footer">
        <span>New to Cafe?</span>{' '}
        <Link className="ghLink" to="/auth/signup">
          Create an account
        </Link>
      </div>
    </div>
  )
}
