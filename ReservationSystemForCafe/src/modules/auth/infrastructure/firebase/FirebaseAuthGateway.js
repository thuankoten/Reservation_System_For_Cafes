import { signInAnonymously, updateProfile } from 'firebase/auth'

export class FirebaseAuthGateway {
  constructor({ auth }) {
    this.auth = auth
  }

  normalizeUser(u) {
    if (!u) return null
    return {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      isAnonymous: u.isAnonymous,
    }
  }

  async ensureAnonymousUser({ displayName }) {
    const name = String(displayName || '').trim()

    if (!this.auth.currentUser) {
      await signInAnonymously(this.auth)
    }

    const u = this.auth.currentUser
    if (!u) throw new Error('Failed to sign in')

    if (name && !u.displayName) {
      await updateProfile(u, { displayName: name })
    }

    return this.normalizeUser(this.auth.currentUser)
  }
}
