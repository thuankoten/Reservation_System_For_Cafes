import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../../shared/firebase'
import { useAuth } from '../useAuth'
import cafeLogo from '../../../assets/images/cafe-logo.png'

export default function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const redirectTo = useMemo(() => {
    const from = location.state?.from?.pathname
    return from || '/dashboard/overview'
  }, [location.state])

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true })
  }, [navigate, redirectTo, user])

  // tạo user 
  async function createUserIfNotExists(user) {
    if (!user || user.isAnonymous) return

    const ref = doc(db, 'users', user.uid)
    const snap = await getDoc(ref)

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: 'customer',
        status: 'active',
        provider: user.providerData?.[0]?.providerId || 'password',
        createdAt: serverTimestamp(),
      })
    }
  }

  async function onSignupWithEmail(e) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)

      if (displayName.trim()) {
        await updateProfile(cred.user, {
          displayName: displayName.trim(),
        })
      }

      await createUserIfNotExists(cred.user)

      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err?.message || 'Sign up failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function onContinueWithGoogle() {
    setError('')
    setSubmitting(true)
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider())
      await createUserIfNotExists(cred.user)
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
        <button
          type="button"
          className="ghAuth__logo"
          aria-label="Go to dashboard"
          onClick={() => navigate('/dashboard/overview')}
        >
          <img className="ghAuth__logoImg" src={cafeLogo} alt="" />
        </button>
        <h1 className="ghAuth__title">Sign up</h1>
      </div>

      <div className="ghAuth__panel">
        <div className="muted">Create a new account</div>

        <div className="stack" style={{ marginTop: 12 }}>
          <div className="authProviders">
            <button
              className="brandIconButton brandIconButton--google"
              disabled={submitting}
              onClick={onContinueWithGoogle}
              type="button"
            >
              G
            </button>

            <button
              className="brandButton"
              disabled={submitting}
              onClick={onContinueAnonymously}
              type="button"
            >
              Guest
            </button>
          </div>
        </div>

        <div className="muted" style={{ marginTop: 12 }}>
          Or sign up with email
        </div>

        <form onSubmit={onSignupWithEmail} className="stack" style={{ marginTop: 12 }}>
          <label className="field">
            <div className="field__label">Name (optional)</div>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input"
            />
          </label>

          <label className="field">
            <div className="field__label">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="input"
            />
          </label>

          <label className="field">
            <div className="field__label">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              className="input"
            />
          </label>

          <label className="field">
            <div className="field__label">Confirm password</div>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              required
              className="input"
            />
          </label>

          {error && <div className="error">{error}</div>}

          <button disabled={submitting} type="submit" className="btn btn--primary">
            {submitting ? 'Please wait…' : 'Create account'}
          </button>

          <button type="button" className="btn" onClick={() => navigate('/auth/login')}>
            Back to Login
          </button>
        </form>
      </div>
    </div>
  )
}
