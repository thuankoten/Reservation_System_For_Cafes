import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

import { USER_STATUS } from '../../domain/userConstants'

export class FirestoreUserRepository {
  constructor({ db }) {
    this.db = db
  }

  async getById({ userId }) {
    if (!userId) throw new Error('Missing userId')
    const ref = doc(this.db, 'users', userId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() }
  }

  async listByRole({ role }) {
    if (!role) throw new Error('Missing role')
    const usersCol = collection(this.db, 'users')
    const q = query(usersCol, where('role', '==', role), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }

  async listByRoles({ roles }) {
    const list = Array.isArray(roles) ? roles.filter(Boolean) : []
    if (list.length === 0) return []
    const usersCol = collection(this.db, 'users')
    const q = query(usersCol, where('role', 'in', list), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }

  async toggleStatus({ userId }) {
    const user = await this.getById({ userId })
    if (!user) throw new Error('User not found')

    const next = user.status === USER_STATUS.ACTIVE ? USER_STATUS.DISABLED : USER_STATUS.ACTIVE
    await updateDoc(doc(this.db, 'users', userId), {
      status: next,
      updatedAt: serverTimestamp(),
    })
    return next
  }

  async deleteProfile({ userId }) {
    if (!userId) throw new Error('Missing userId')
    await deleteDoc(doc(this.db, 'users', userId))
  }
}
