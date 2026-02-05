import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

export class FirestoreTableRepository {
  constructor({ db }) {
    this.db = db
  }

  async create({ table }) {
    const payload = {
      ...(table || {}),
      updatedAt: serverTimestamp(),
    }
    await addDoc(collection(this.db, 'tables'), payload)
  }

  subscribeAll({ onNext, onError }) {
    const q = query(collection(this.db, 'tables'), orderBy('number', 'asc'))
    return onSnapshot(
      q,
      (snap) => {
        onNext(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      },
      (e) => onError?.(e)
    )
  }

  async setStatus({ tableId, status }) {
    if (!tableId) throw new Error('Missing tableId')
    await updateDoc(doc(this.db, 'tables', tableId), {
      status,
      updatedAt: serverTimestamp(),
    })
  }

  async update({ tableId, updates }) {
    if (!tableId) throw new Error('Missing tableId')
    await updateDoc(doc(this.db, 'tables', tableId), {
      ...(updates || {}),
      updatedAt: serverTimestamp(),
    })
  }

  async delete({ tableId }) {
    if (!tableId) throw new Error('Missing tableId')
    await deleteDoc(doc(this.db, 'tables', tableId))
  }

  async assignFloors({ tables }) {
    const sorted = (tables || []).slice().sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))
    const perFloor = Math.max(1, Math.ceil(sorted.length / 3))
    const batch = writeBatch(this.db)
    for (let i = 0; i < sorted.length; i += 1) {
      const r = sorted[i]
      const floor = Math.min(3, Math.max(1, Math.floor(i / perFloor) + 1))
      batch.update(doc(this.db, 'tables', r.id), {
        floor,
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }

  async occupyManual({ tableId, note }) {
    if (!tableId) throw new Error('Missing tableId')
    await updateDoc(doc(this.db, 'tables', tableId), {
      status: 'occupied',
      manualOccupiedSince: serverTimestamp(),
      manualOccupiedUntil: deleteField(),
      manualOccupiedNote: note || null,
      updatedAt: serverTimestamp(),
    })
  }

  async releaseManual({ tableId, keepReserved }) {
    if (!tableId) throw new Error('Missing tableId')
    await updateDoc(doc(this.db, 'tables', tableId), {
      status: keepReserved ? 'reserved' : 'available',
      manualOccupiedUntil: serverTimestamp(),
      manualOccupiedSince: deleteField(),
      manualOccupiedNote: deleteField(),
      updatedAt: serverTimestamp(),
    })
  }
}
