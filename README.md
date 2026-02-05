# Reservation System For Cafes

Ứng dụng web **quản lý/đặt bàn cho quán cà phê** với 2 khu vực:

- **Customer Dashboard**: xem bàn, đặt chỗ theo timeline, quản lý đặt chỗ cá nhân
- **Admin Dashboard**: quản trị bàn, duyệt/huỷ/điều phối đặt chỗ, quản lý tài khoản

Tech stack: **React (Vite)** + **Firebase (Firestore/Auth/Storage)**.

---

## Tính năng chính

### Customer

- Đặt bàn theo ngày/khung giờ (block 30 phút)
- Thấy bàn khả dụng theo **time range** (không chỉ theo trạng thái cả ngày)
- **Guest booking**: khách chưa đăng nhập vẫn có thể đặt bàn (đăng nhập anonymous)
- Quản lý các đặt chỗ của mình (pending/confirmed/older…)

### Admin

- Quản lý bàn (`tables`): tạo/sửa/xoá, phân tầng (`floors`), check-in/out thủ công
- Quản lý đặt chỗ (`reservations`): duyệt/từ chối/huỷ, tự động expire các reservation quá hạn
- Quản lý người dùng (`users`): bật/tắt trạng thái, xoá profile

---

## Công nghệ sử dụng

- **React 19**
- **Vite**
- **React Router**
- **Firebase**: Firestore, Auth, Storage
- **ESLint**

---

## Kiến trúc (SOLID / Layered)

Dự án đã được refactor theo hướng module hoá:

- `src/modules/*`
  - `domain/`: policy, constants (pure)
  - `application/`: use cases, presenters, query hooks
  - `infrastructure/`: Firestore repositories, Firebase gateways
- `src/app/ServiceContainer.jsx`: Dependency Injection container (repos/useCases)
- `src/features/*`: UI pages/components

Mục tiêu:

- Pages không import trực tiếp Firestore/Auth
- Business rules nằm trong use case / policy / presenter

---

## Yêu cầu

- Node.js **18+**
- npm
- Một Firebase project đã bật:
  - Firestore
  - Firebase Auth (khuyến nghị)

---

## Cài đặt & Chạy dự án

Lưu ý: source app nằm trong thư mục con `ReservationSystemForCafe/`.

### 1) Cài dependencies

```bash
cd ReservationSystemForCafe
npm install
```

### 2) Cấu hình Firebase (Vite env)

Tạo file `ReservationSystemForCafe/.env.local`:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Firebase được khởi tạo tại `ReservationSystemForCafe/src/shared/firebase/index.js`.

### 3) Run dev server

```bash
npm run dev
```

Mặc định: http://localhost:5173

---

## Scripts

Chạy trong thư mục `ReservationSystemForCafe/`:

- `npm run dev`: chạy dev server
- `npm run build`: build production
- `npm run preview`: preview bản build
- `npm run lint`: chạy ESLint

---

## Routing nhanh

### Customer

- `/dashboard/overview`
- `/dashboard/tables`
- `/dashboard/reservations`

### Admin

- `/admin/dashboard`
- `/admin/dashboard/tables`
- `/admin/dashboard/reservations`
- `/admin/dashboard/accounts`

---

## Firestore Data Model (tóm tắt)

### `tables`

- `number`: số bàn
- `seats`: số ghế
- `status`: `available | reserved | occupied`

Sub-collection:

- `tables/{tableId}/slots/{slotId}`: khoá các time slots theo reservation (dùng để check trùng lịch)

### `reservations`

- `userId`, `userEmail`, `isAnonymous`
- `tableId`, `tableNumber`, `partySize`
- `startTime`, `endTime`, `durationMinutes`
- `status`: `hold | confirmed | cancelled | rejected | expired | ...`
- `holdExpiresAt`
- `slotKeys`: danh sách slot keys đã lock

### `users`

- `role`: `customer | admin | system-admin`
- `status`: `active | disabled`

---

## Firestore Rules

File rules tham khảo/đang dùng: `ReservationSystemForCafe/firestore.rules`.

Nếu gặp lỗi `Missing or insufficient permissions`:

- **Kiểm tra Firestore rules**
- **Kiểm tra user role** trong document `users/{uid}` (admin/system-admin)

---

## Troubleshooting

### Missing Firebase env

Nếu app báo lỗi thiếu Firebase config, kiểm tra:

- `ReservationSystemForCafe/.env.local`
- Restart dev server sau khi sửa env

### Không đặt bàn được

- Đảm bảo đã nhập các trường bắt buộc (ví dụ: Phone)
- Kiểm tra Firestore rules cho phép tạo `reservations` và `slots`

---

## Contributors

- thuankoten
- HoNgocVy05
- NhuPhuc301
- GiaMinhh39

## Liên hệ

- thuantt1708@ut.edu.com
- thuankhung2k5@gmail.com
- hongocvy05@gmail.com
- nhuphuc301@gmail.com

## License

Chưa khai báo license.
