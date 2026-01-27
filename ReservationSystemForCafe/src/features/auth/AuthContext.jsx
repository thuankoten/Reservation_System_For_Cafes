import { useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, onIdTokenChanged } from 'firebase/auth'
import { auth } from '../../shared/firebase'
import { AuthContext } from './authContext'

function normalizeUser(u) {
  if (!u) return null
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
    isAnonymous: u.isAnonymous,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    if (!auth.currentUser) {
      setUser(null)
      return
    }
    await auth.currentUser.reload()
    setUser(normalizeUser(auth.currentUser))
  }

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(normalizeUser(u))
      setLoading(false)
    })

    const unsubToken = onIdTokenChanged(auth, (u) => {
      setUser(normalizeUser(u))
    })

    return () => {
      unsubAuth()
      unsubToken()
    }
  }, [])

  const value = useMemo(() => ({ user, loading, refreshUser }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
