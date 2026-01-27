import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from '../firebase'

export const USER_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
}

export const USER_ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  SYSTEM_ADMIN: 'system-admin',
}

// Get all users
export async function getAllUsers() {
  const usersCol = collection(db, 'users')
  const q = query(usersCol, orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Get user by ID
export async function getUserById(userId) {
  const userRef = doc(db, 'users', userId)
  const snap = await getDoc(userRef)
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Create user profile (called after Firebase Auth user creation)
export async function createUserProfile(uid, data) {
  const userRef = doc(db, 'users', uid)
  await setDoc(userRef, {
    ...data,
    status: USER_STATUS.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
}

// Update user profile
export async function updateUserProfile(uid, updates) {
  const userRef = doc(db, 'users', uid)
  await updateDoc(userRef, {
    ...updates,
    updatedAt: new Date(),
  })
}

// Delete user profile
export async function deleteUserProfile(uid) {
  const userRef = doc(db, 'users', uid)
  await deleteDoc(userRef)
}

// Toggle user status (active/disabled)
export async function toggleUserStatus(uid) {
  const user = await getUserById(uid)
  if (!user) throw new Error('User not found')

  const newStatus = user.status === USER_STATUS.ACTIVE ? USER_STATUS.DISABLED : USER_STATUS.ACTIVE
  await updateUserProfile(uid, { status: newStatus })
  return newStatus
}

// Get users by role
export async function getUsersByRole(role) {
  const usersCol = collection(db, 'users')
  const q = query(usersCol, where('role', '==', role), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Get admin users (admin + system-admin)
export async function getAdminUsers() { 
  const usersCol = collection(db, 'users')
  const q = query(
    usersCol,
    where('role', 'in', [USER_ROLES.ADMIN, USER_ROLES.SYSTEM_ADMIN]),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Get customer users
export async function getCustomerUsers() {
  return getUsersByRole(USER_ROLES.CUSTOMER)
}