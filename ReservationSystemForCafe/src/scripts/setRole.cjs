const admin = require('firebase-admin')

const serviceAccount = require('./serviceAccountKey.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

async function setRole(uid, role) {
  await admin.auth().setCustomUserClaims(uid, { role })
  await admin.firestore().doc(`users/${uid}`).update({role: { role }})
  console.log(`Set role = ${role} for uid = ${uid}`)
}

setRole('cxU1YqeFpfajt8Uhw4LGSkSkncB3', 'system-admin') 