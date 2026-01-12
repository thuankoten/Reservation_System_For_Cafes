import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithPhoneNumber,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../../../shared/firebase'
import { useAuth } from '../AuthContext.jsx'

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

  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [confirmationResult, setConfirmationResult] = useState(null)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true })
  }, [navigate, redirectTo, user])

  function ensureRecaptcha() {
    if (window.recaptchaVerifier) return window.recaptchaVerifier

    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    })

    window.recaptchaVerifier = verifier
    return verifier
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
        await updateProfile(cred.user, { displayName: displayName.trim() })
      }
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

  async function onSendOtp() {
    setError('')
    setSubmitting(true)
    try {
      const verifier = ensureRecaptcha()
      const result = await signInWithPhoneNumber(auth, phone, verifier)
      setConfirmationResult(result)
    } catch (err) {
      setError(err?.message || 'Failed to send OTP')
    } finally {
      setSubmitting(false)
    }
  }

  async function onVerifyOtp() {
    setError('')
    if (!confirmationResult) return
    setSubmitting(true)
    try {
      await confirmationResult.confirm(otp)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err?.message || 'Invalid OTP')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <h2 className="pageTitle">Sign up</h2>
      <div className="muted">Create a new account</div>

      <div className="stack" style={{ marginTop: 12 }}>
        <button className="btn btn--primary" disabled={submitting} onClick={onContinueWithGoogle}>
          Continue with Google
        </button>

        <button className="btn" disabled={submitting} onClick={onContinueAnonymously}>
          Continue as Guest (Anonymous)
        </button>
      </div>

      <div className="muted" style={{ marginTop: 12 }}>
        Or sign up with email
      </div>

      <form onSubmit={onSignupWithEmail} className="stack" style={{ marginTop: 12 }}>
        <label className="field">
          <div className="field__label">Name (optional)</div>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" />
        </label>

        <label className="field">
          <div className="field__label">Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="input" />
        </label>

        <label className="field">
          <div className="field__label">Password</div>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="input" />
        </label>

        <label className="field">
          <div className="field__label">Confirm password</div>
          <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" required className="input" />
        </label>

        {error ? <div className="error">{error}</div> : null}

        <button disabled={submitting} type="submit" className="btn btn--primary">
          {submitting ? 'Please wait…' : 'Create account'}
        </button>

        <button type="button" className="btn" onClick={() => navigate('/auth/login')}>
          Back to Login
        </button>
      </form>

      <div className="muted" style={{ marginTop: 14 }}>
        Or sign up with phone
      </div>

      <div className="stack" style={{ marginTop: 12 }}>
        <label className="field">
          <div className="field__label">Phone number</div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="+84..." />
        </label>

        {!confirmationResult ? (
          <button className="btn" disabled={submitting || !phone} onClick={onSendOtp} type="button">
            Send OTP
          </button>
        ) : (
          <>
            <label className="field">
              <div className="field__label">OTP</div>
              <input value={otp} onChange={(e) => setOtp(e.target.value)} className="input" placeholder="123456" />
            </label>
            <button className="btn btn--primary" disabled={submitting || !otp} onClick={onVerifyOtp} type="button">
              Verify OTP
            </button>
          </>
        )}

        <div id="recaptcha-container" />
      </div>
    </div>
  )
}
