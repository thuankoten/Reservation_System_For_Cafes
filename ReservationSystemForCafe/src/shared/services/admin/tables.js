import { doc, serverTimestamp, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore'

export async function setTableStatus({ db, tableId, status }) {
  if (!tableId) throw new Error('Missing tableId')
  await updateDoc(doc(db, 'tables', tableId), {
    status,
    updatedAt: serverTimestamp(),
  })
}

export async function updateTable({ db, tableId, updates }) {
  if (!tableId) throw new Error('Missing tableId')
  await updateDoc(doc(db, 'tables', tableId), {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function removeTable({ db, tableId }) {
  if (!tableId) throw new Error('Missing tableId')
  await deleteDoc(doc(db, 'tables', tableId))
}

export async function assignFloors({ db, tables }) {
  const sorted = (tables || [])
    .slice()
    .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))
  const perFloor = Math.max(1, Math.ceil(sorted.length / 3))
  const batch = writeBatch(db)
  for (let i = 0; i < sorted.length; i += 1) {
    const r = sorted[i]
    const floor = Math.min(3, Math.max(1, Math.floor(i / perFloor) + 1))
    batch.update(doc(db, 'tables', r.id), {
      floor,
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
}
