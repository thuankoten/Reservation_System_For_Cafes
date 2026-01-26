[README.md](https://github.com/user-attachments/files/24867427/README.md)
# Reservation System For Cafes

Ứng dụng web quản lý/đặt chỗ cho quán cà phê, xây dựng với React (Vite) và Firebase (Firestore/Auth). Dự án bao gồm dashboard khách hàng và admin dashboard (quản trị bàn) với giao diện sidebar trái.

## Giới thiệu dự án

Dự án nhằm cung cấp một hệ thống đặt chỗ/quan sát tình trạng bàn theo thời gian thực cho quán cà phê.

- **Customer Dashboard**: Overview, Tables, Reservations, Menu, Chat, Report
- **Admin Dashboard**: Quản trị `tables`

## Prerequisites

- Node.js (khuyến nghị: Node 18+)
- npm (đi kèm Node.js)
- Firebase project (Firestore + tuỳ chọn Firebase Auth)

## Cách cài đặt

### 1) Clone project

```bash
git clone <your-repo-url>
cd ReservationSystemForCafe
```

### 2) Cài dependencies

```bash
npm install
```

### 3) Cấu hình Firebase

Tạo file `.env.local` ở root project:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Sau đó khởi động lại dev server.

### 4) Chạy dự án

```bash
npm run dev
```

Mặc định: http://localhost:5173

## Cách sử dụng (Usage)

### Customer Dashboard

- `/dashboard/overview`
- `/dashboard/tables`
- `/dashboard/reservations`

Trang **Tables** hỗ trợ:

- Tabs: `Table Map`, `Table by Customer`, `TimeLine`
- Filter: `All`, `Free`, `Reserved`, `Occupied`
- Nút **Seed demo tables** để tạo dữ liệu mẫu `tables` (T01..T20) (cần Firestore rules cho phép write)

### Admin Dashboard

- `/admin/dashboard`
- `/admin/dashboard/tables`

Trang **Admin • Tables** hỗ trợ:

- Thêm bàn mới
- Sửa `number`, `seats`, `status`
- Xoá bàn

## Database (Firestore)

### Collection: `tables`

Mỗi document trong `tables` có các field:

- `number` (number)
- `seats` (number)
- `status` (string: `available | reserved | occupied`)
- `updatedAt` (Firestore timestamp)

## Firestore Rules (lưu ý)

Nếu bạn gặp lỗi `Missing or insufficient permissions`, nguyên nhân thường do Firestore Rules đang chặn.

Để test nhanh (DEV ONLY), bạn có thể tạm thời mở rule:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Scripts

- `npm run dev`: chạy dev server
- `npm run build`: build production
- `npm run preview`: preview production build
- `npm run lint`: chạy ESLint

## Contributors

- thuankoten
- HoNgocVy05
- NhuPhuc301
- GiaMinhh39

## Thông tin liên lạc

- thuantt1708@ut.edu.com
- thuankhung2k5@gmail.com

## Bản quyền

Hiện chưa có bản quyền
