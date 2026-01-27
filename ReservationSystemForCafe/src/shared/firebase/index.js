import { initializeApp } from 'firebase/app'
import { browserSessionPersistence, getAuth, setPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

function readEnv(name) {
  const v = import.meta.env[name]
  return typeof v === 'string' ? v.trim() : v
}

const firebaseConfig = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID'),
}

if (import.meta.env.DEV) {
  const key = firebaseConfig.apiKey
  const keyPreview = typeof key === 'string' ? `${key.slice(0, 6)}...${key.slice(-4)}` : String(key)
  console.info('[firebase] env check', {
    apiKey: keyPreview,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
  })
}

const required = ['apiKey', 'authDomain', 'projectId', 'appId']
const missing = required.filter((k) => !firebaseConfig[k])
if (missing.length > 0) {
  throw new Error(`Missing Firebase config: ${missing.join(', ')}. Check .env.local and restart dev server.`)
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
setPersistence(auth, browserSessionPersistence).catch(() => {})
export const db = getFirestore(app)
export const storage = getStorage(app)
