<div align="center">

<img src="./logo.svg" width="96" alt="KADA Logo" />

# KADA Kopi Business Management System

Backend service untuk platform manajemen bisnis Kopi (UMKM), dibangun dengan Node.js, Express, dan MongoDB.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)](https://mongoosejs.com)
[![JWT](https://img.shields.io/badge/Auth-JWT%20%2B%20Rotating%20Refresh%20Token-black?logo=jsonwebtokens&logoColor=white)](#)
[![Joi](https://img.shields.io/badge/Validation-Joi-orange)](https://joi.dev)
[![License](https://img.shields.io/badge/License-Private-lightgrey)](#)

</div>

---

## Daftar Isi

- [Tentang Proyek](#tentang-proyek)
- [Tech Stack](#tech-stack)
- [Struktur Folder](#struktur-folder)
- [Arsitektur](#arsitektur)
- [Modul: Authentication](#modul-authentication)
- [Modul: Inventory](#modul-inventory)
- [Modul: Menu](#modul-menu)
- [Modul: Production Plan (Planning)](#modul-production-plan-planning)
- [Modul: Sales](#modul-sales)
- [Modul: Dashboard](#modul-dashboard)
- [Environment Variables](#environment-variables)
- [Menjalankan Proyek](#menjalankan-proyek)

---

## Tentang Proyek

**KADA** adalah sistem manajemen bisnis Kopi yang membantu pelaku UMKM mengelola inventory,
menu, production plan, dan penjualan dalam satu platform, dilengkapi rekomendasi _production
plan_ berbasis AI (LLM-as-advisor) dan Menu Engineering Matrix.

Seluruh modul inti sudah berjalan: **Authentication**, **Inventory**, **Menu**,
**Production Plan**, **Sales**, dan **Dashboard** ringkasan bisnis.

## Tech Stack

| Layer                 | Teknologi                                | Alasan                                                                     |
| --------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| Runtime & Framework   | Node.js + Express                        | Standar industri untuk REST API, ekosistem matang                          |
| Database              | MongoDB + Mongoose                       | Schema fleksibel, cocok untuk domain yang relasinya berubah-ubah           |
| Access Token          | JSON Web Token (JWT)                     | Stateless, cepat diverifikasi, mudah di-scale horizontal                   |
| Refresh Token         | Random string (opaque) + SHA-256 hash    | Bisa di-_rotate_ & di-_revoke_ per sesi, tidak bisa dilakukan di JWT murni |
| Password Hashing      | bcryptjs                                 | Salted hash, standar industri untuk kredensial                             |
| OTP Hashing           | crypto (SHA-256, built-in)               | OTP berumur pendek, tidak perlu cost factor bcrypt yang berat              |
| Validasi Input        | Joi                                      | Deklaratif, terpisah dari business logic                                   |
| Email Delivery        | Brevo Transactional API                  | Alternatif SMTP yang tidak diblokir hosting free-tier                      |
| Security Headers      | Helmet                                   | Mitigasi XSS, clickjacking, MIME sniffing                                  |
| Rate Limiting         | express-rate-limit                       | Mencegah brute-force pada endpoint login & OTP                             |
| NoSQL Injection Guard | express-mongo-sanitize                   | Membersihkan operator `$` dari input user                                  |
| Logging               | Winston + Morgan                         | Log terstruktur untuk debugging di production                              |
| Testing               | Jest + Supertest + mongodb-memory-server | Test terisolasi tanpa butuh instance MongoDB eksternal                     |

## Struktur Folder

```
src/
├── config/         # Load & validasi environment variables (Joi), koneksi DB
├── controllers/     # Terima request, panggil service, bentuk response
├── middlewares/      # authenticate, validate, rate limiter, error handler
├── models/           # Schema Mongoose per domain
├── routes/           # Definisi endpoint per modul
├── services/         # Business logic per modul
├── utils/            # Helper murni (hashToken, ApiError, ApiResponse, otp, mailer, pricing)
└── validations/       # Schema Joi per modul
```

## Arsitektur

**Prinsip arsitektur:** `Route → Middleware (validate/auth) → Controller → Service → Model`

- **Route** — definisi endpoint & middleware yang dipasang
- **Controller** — terima `req`, panggil service, kirim `res`; tanpa business logic
- **Service** — seluruh business logic, tidak bergantung pada `req`/`res`, mudah di-unit-test
- **Model** — struktur data & aturan di level database (hashing password, index, dsb.)

Semua endpoint berada di bawah prefix `/api/v1` dan dilindungi stack keamanan global:
Helmet, CORS ber-_credential_, rate limiter, serta NoSQL injection sanitizer.

---

## Modul: Authentication

Sistem auth menggunakan pendekatan **satu sesi aktif per user** (_single-device login_) dan
**rotating refresh token**. Refresh token yang bocor tidak bisa dipakai selamanya, dan tidak
ada dua device yang bisa login bersamaan atas nama user yang sama.

### Strategi Token

| Token             | Bentuk                            | Umur                            | Disimpan di                           | Karakteristik                                                      |
| ----------------- | --------------------------------- | ------------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| **Access Token**  | JWT                               | Pendek (15 menit)               | Memory di client                      | Berisi `sub`, `role`, `tokenVersion`; validasi cukup 1x query DB   |
| **Refresh Token** | Random string opaque (64 bytes)   | 7 hari (web) / 30 hari (mobile) | httpOnly Cookie (web) / body (mobile) | Single-use, rotasi tiap kali dipakai, dikelompokkan per `familyId` |
| **Reset Token**   | JWT terpisah (`JWT_RESET_SECRET`) | Sangat pendek (10 menit)        | Body request                          | Sekali pakai, di-scope dengan `purpose` + `nonce`                  |

**Kenapa refresh token tidak lagi berupa JWT?**
JWT bersifat stateless by design, sehingga sulit di-_rotate_ atau dideteksi pemakaian
ulangnya (_reuse_). Refresh token sekarang berupa string acak yang di-hash (SHA-256) sebelum
disimpan, dengan metadata `familyId`, `parentId`, `usedAt`, dan `revokedAt` — memberi kontrol
penuh atas siklus hidup tiap sesi.

**Kenapa access token menyimpan `tokenVersion`?**
`tokenVersion` adalah angka di dokumen `User` yang naik setiap kali ada login baru, refresh,
logout, atau ganti password. Middleware `authenticate` membandingkan `tokenVersion` di dalam
token dengan yang ada di database — kalau tidak cocok, akses ditolak seketika, walau access
token secara teknis belum _expired_. Ini yang membuat _single-device enforcement_ dan
_instant revocation_ bisa terjadi tanpa perlu blacklist token satu-satu.

### Alur Utama

1. **Register & Verifikasi Email** — user dibuat dengan `isEmailVerified: false`, kode OTP
   langsung dikirim ke email. Token login **belum** diterbitkan sampai email diverifikasi.
2. **Login (single session enforcement)** — kredensial valid & email terverifikasi memicu
   `enforceSingleSession`: seluruh refresh token aktif di-_revoke_ dan `tokenVersion`
   dinaikkan, baru setelah itu token baru diterbitkan untuk device yang login. Device lama
   otomatis ter-_logout_.
3. **Akses endpoint terproteksi** — middleware `authenticate` verifikasi signature & masa
   berlaku JWT, cocokkan `tokenVersion`, dan pastikan token tidak terbit sebelum
   `passwordChangedAt`.
4. **Refresh token (rotasi & deteksi reuse)** — token lama diklaim secara atomic lalu
   ditandai terpakai; kalau token yang sama dicoba dipakai lagi (indikasi pencurian),
   seluruh `familyId` langsung di-_revoke_ dan user wajib login ulang.
5. **Logout** — refresh token sesi aktif di-_revoke_, `tokenVersion` dinaikkan sehingga
   access token yang dipegang client langsung tidak valid.
6. **Forgot → Reset Password** — tiga langkah (kirim kode → verifikasi kode → reset), diakhiri
   dengan revoke seluruh refresh token agar semua device wajib login ulang.
7. **Change Password** — menaikkan `tokenVersion` & revoke sesi lain; device yang sedang
   dipakai tetap aman karena request ini sendiri membutuhkan access token yang masih valid.

### Endpoint

Base path: `/api/v1/auth`

| Method | Endpoint                       | Auth | Deskripsi                                                       |
| ------ | ------------------------------ | ---- | --------------------------------------------------------------- |
| POST   | `/register`                    | –    | Registrasi user, mengirim kode verifikasi email                 |
| POST   | `/verify-email/send`           | –    | Kirim / kirim ulang kode verifikasi email                       |
| POST   | `/verify-email/confirm`        | –    | Konfirmasi kode verifikasi email                                |
| POST   | `/login`                       | –    | Login; revoke sesi lama, terbitkan token baru                   |
| POST   | `/refresh`                     | –    | Rotasi refresh token, terbitkan access token baru               |
| POST   | `/logout`                      | –    | Revoke sesi & invalidasi access token saat ini                  |
| GET    | `/me`                          | Ya   | Ambil data user yang sedang login                               |
| PATCH  | `/change-password`             | Ya   | Ganti password; revoke semua sesi lain                          |
| POST   | `/forgot-password`             | –    | Kirim kode reset password (silent terhadap email tak terdaftar) |
| POST   | `/forgot-password/verify-code` | –    | Verifikasi kode, terbitkan `resetToken`                         |
| POST   | `/reset-password`              | –    | Reset password menggunakan `resetToken`                         |

---

## Modul: Inventory

Mengelola stok bahan baku milik masing-masing user. Setiap item inventory punya periode
kevalidan (`validFrom`–`validTo`) dan `unitCost` yang merepresentasikan **total biaya per
batch pembelian** (bukan harga per unit) — harga per unit dihitung on-the-fly sebagai
`unitCost / quantity` saat dibutuhkan oleh modul Menu maupun Sales.

### Alur Utama

- **Create** — validasi field (`unit` harus salah satu dari `gram/kg/ml/liter/pcs/piece`,
  `validTo` > `validFrom`), cek duplikat nama bahan per user, lalu simpan.
- **Update** — partial update, `validTo` tetap divalidasi terhadap `validFrom` bila keduanya
  dikirim.
- **Delete** — ditolak (`409`) apabila item masih dipakai sebagai ingredient di salah satu
  Menu, untuk menjaga integritas perhitungan harga pokok.
- **Options** — endpoint ringkas untuk kebutuhan dropdown di frontend.

### Endpoint

Base path: `/api/v1/inventory`

| Method | Endpoint   | Auth | Deskripsi                                       |
| ------ | ---------- | ---- | ----------------------------------------------- |
| GET    | `/`        | Ya   | List inventory (pagination, search, sort)       |
| GET    | `/options` | Ya   | Daftar ringkas untuk dropdown                   |
| GET    | `/:id`     | Ya   | Detail item inventory                           |
| POST   | `/`        | Ya   | Tambah item inventory baru                      |
| PATCH  | `/:id`     | Ya   | Update sebagian field item inventory            |
| DELETE | `/:id`     | Ya   | Hapus item (ditolak jika masih dipakai di Menu) |

---

## Modul: Menu

Menu terdiri dari daftar _ingredient_ yang menunjuk ke Inventory milik user yang sama.
Harga pokok (`costPrice`) dan laba (`profit`) dihitung secara konsisten lewat satu _single
source of truth_ (`utils/menuPricing.js`), dipakai ulang baik saat menampilkan detail menu
maupun saat transaksi penjualan dicatat.

### Alur Utama

- **Create/Update** — validasi tiap ingredient (`inventoryId` valid, tidak duplikat dalam
  satu payload, milik user yang sama), lalu simpan `Menu` + `MenuIngredient` dalam satu
  transaction (atomic).
- **Detail/List** — mengembalikan menu berikut `costPrice` dan `profit` yang dihitung dari
  harga per unit tiap ingredient dikalikan `quantityNeeded`.
- **Delete** — ditolak (`409`) apabila menu masih direferensikan oleh salah satu Production
  Plan.

### Endpoint

Base path: `/api/v1/menu`

| Method | Endpoint | Auth | Deskripsi                                            |
| ------ | -------- | ---- | ---------------------------------------------------- |
| GET    | `/`      | Ya   | List menu (pagination, search, sort)                 |
| GET    | `/:id`   | Ya   | Detail menu + `costPrice` & `profit`                 |
| POST   | `/`      | Ya   | Buat menu baru beserta ingredient-nya                |
| PUT    | `/:id`   | Ya   | Update menu & daftar ingredient                      |
| DELETE | `/:id`   | Ya   | Hapus menu (ditolak jika dipakai di Production Plan) |

---

## Modul: Production Plan (Planning)

Merencanakan produksi untuk periode tertentu dengan menentukan menu apa saja beserta
jumlahnya, lalu menghitung total kebutuhan bahan baku secara agregat di seluruh menu dalam
plan tersebut.

### Alur Utama

- **Create** — validasi tidak ada `menuId` duplikat, pastikan seluruh menu milik user, lalu
  simpan `Planning` + `PlanningItem` dalam satu transaction.
- **Detail** — mengagregasi kebutuhan tiap bahan baku lintas menu (`materialCalculation.
service.js`), membandingkan `needed` vs `available`, dan menandai status **CUKUP**/**KURANG**
  per bahan berikut rincian menu mana saja yang berkontribusi terhadap kebutuhan tersebut.
- **Delete** — menghapus `Planning` beserta seluruh `PlanningItem` terkait dalam transaction.

### Endpoint

Base path: `/api/v1/planning`

| Method | Endpoint | Auth | Deskripsi                                                  |
| ------ | -------- | ---- | ---------------------------------------------------------- |
| POST   | `/`      | Ya   | Buat production plan baru                                  |
| GET    | `/`      | Ya   | List seluruh plan milik user                               |
| GET    | `/:id`   | Ya   | Detail plan + agregasi kebutuhan bahan baku (CUKUP/KURANG) |
| DELETE | `/:id`   | Ya   | Hapus plan beserta seluruh item di dalamnya                |

---

## Modul: Sales

Mencatat transaksi penjualan sekaligus memotong stok inventory secara atomik dan menyimpan
_snapshot_ harga & nama menu pada saat transaksi terjadi — sehingga riwayat penjualan tetap
akurat meskipun menu-nya diedit atau dihapus di kemudian hari.

### Alur Utama

1. Ambil pricing (`sellingPrice`, `costPrice`) untuk seluruh `menuId` dalam transaksi.
2. Hitung total kebutuhan tiap bahan baku secara agregat lintas item.
3. Potong stok per `inventoryId` secara atomik (filter query menyertakan `quantity >=
amount`); jika salah satu bahan tidak cukup, seluruh pengurangan stok yang sudah terjadi
   di-_rollback_ dan request ditolak (`409`).
4. Simpan `Sale`, `SaleItem` (snapshot harga & nama), dan `StockMovement` (audit trail
   `quantityBefore`/`quantityAfter`) sebagai satu kesatuan.

### Endpoint

Base path: `/api/v1/sales`

| Method | Endpoint | Auth | Deskripsi                                                 |
| ------ | -------- | ---- | --------------------------------------------------------- |
| GET    | `/`      | Ya   | List transaksi (filter tanggal, pagination, sort)         |
| GET    | `/:id`   | Ya   | Detail transaksi + item & stock movement terkait          |
| POST   | `/`      | Ya   | Catat transaksi baru, potong stok inventory secara atomik |

---

## Modul: Dashboard

Menyediakan ringkasan metrik lintas modul (penjualan, kondisi stok, dan plan aktif) dalam
satu endpoint untuk kebutuhan halaman utama aplikasi.

### Endpoint

Base path: `/api/v1/dashboard`

| Method | Endpoint   | Auth | Deskripsi                                          |
| ------ | ---------- | ---- | -------------------------------------------------- |
| GET    | `/summary` | Ya   | Ringkasan metrik dashboard (sales, stok, planning) |

---

## Environment Variables

| Variable                                   | Keterangan                                              |
| ------------------------------------------ | ------------------------------------------------------- |
| `NODE_ENV`                                 | `development` / `production` / `test`                   |
| `PORT`                                     | Port server (default `5000`)                            |
| `CLIENT_URL`                               | Origin frontend untuk konfigurasi CORS                  |
| `MONGO_URI`                                | Connection string MongoDB                               |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES` | Secret & masa berlaku access token (default `15m`)      |
| `JWT_REFRESH_EXPIRES`                      | Referensi masa berlaku refresh token web (default `7d`) |
| `JWT_RESET_SECRET` / `JWT_RESET_EXPIRES`   | Secret & masa berlaku `resetToken` (default `10m`)      |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX`  | Konfigurasi rate limiter global                         |
| `BREVO_API_KEY` / `SMTP_USER`              | Kredensial pengiriman email transaksional (Brevo)       |
| `OTP_LENGTH` / `OTP_EXPIRES_MINUTES`       | Konfigurasi kode OTP verifikasi email & reset password  |
| `OTP_RESEND_COOLDOWN_SECONDS`              | Cooldown sebelum OTP boleh dikirim ulang (default `60`) |
| `OTP_MAX_ATTEMPTS`                         | Batas percobaan input kode OTP sebelum diblok           |

## Menjalankan Proyek

```bash
# instalasi dependency
npm install

# salin .env.example → .env, lalu isi sesuai environment
cp .env.example .env

# jalankan dalam mode development
npm run dev

# menjalankan test
npm test
```

---

<div align="center">
<sub>Dibangun oleh 505-Kada-Team MERN Stack</sub>
</div>
