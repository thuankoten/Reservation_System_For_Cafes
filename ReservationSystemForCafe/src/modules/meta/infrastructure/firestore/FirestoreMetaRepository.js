import { doc, getDocFromServer, serverTimestamp, setDoc } from 'firebase/firestore'

export class FirestoreMetaRepository {
  constructor({ db }) {
    this.db = db
  }

  async pingServerOffsetMinutes() {
    const ref = doc(this.db, 'meta', 'timePing')
    await setDoc(ref, { pingedAt: serverTimestamp() }, { merge: true })

    const snap = await getDocFromServer(ref)
    const serverNow = snap.data()?.pingedAt?.toDate?.()
    if (!(serverNow instanceof Date)) return 0

    const offsetMs = serverNow.getTime() - Date.now()
    const offsetMin = Math.round(offsetMs / 60000)
    const safeOffset = Number.isFinite(offsetMin) ? offsetMin : 0
    return Math.abs(safeOffset) <= 5 ? safeOffset : 0
  }
}
