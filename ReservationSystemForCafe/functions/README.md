# Scheduled Expiration for Reservations

This Firebase Cloud Function expires overdue confirmed reservations and frees tables automatically, even when the app is closed.

## What it does
- Every 5 minutes:
  - Finds `reservations` with `status == 'confirmed'`.
  - If `endTime` passed OR `startTime` was 30 minutes ago and not checked in, sets `status = 'expired'`.
  - Updates `tables/<tableId>` to `status = 'available'`.

## Deploy steps

1. Install Firebase CLI (once):

```bash
npm install -g firebase-tools
firebase login
```

2. Initialize functions (if not already):

```bash
firebase init functions
# Choose your Firebase project
# Language: JavaScript
# Use existing files when prompted (to keep index.js and package.json)
```

3. Deploy the scheduled function:

```bash
cd functions
npm install
firebase deploy --only functions
```

The function `expireOverdueReservations` will run every 5 minutes in the `Asia/Ho_Chi_Minh` time zone.

## Notes
- Data model assumptions: `reservations` has `status`, `startTime`, `endTime`, `checkedInAt`, `tableId` fields; `tables` has `status`.
- You can adjust the schedule by editing `schedule('every 5 minutes')` in `index.js`.
