<div align="center">

<img src="./assets/logo.svg" width="96" alt="KADA Logo" />

# KADA — F&B Business Management System

Backend service untuk platform manajemen bisnis F&B (UMKM), dibangun dengan Node.js, Express, dan MongoDB.

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
- [Modul: Authentication](#modul-authentication)
  - [Strategi Token](#strategi-token)
  - [Alur Utama](#alur-utama)
- [Environment Variables](#environment-variables)
- [API Endpoints — Auth](#api-endpoints--auth)
- [Menjalankan Proyek](#menjalankan-proyek)
- [Roadmap](#roadmap)

---

## Tentang Proyek

**KADA** adalah sistem manajemen bisnis F&B yang membantu pelaku UMKM mengelola inventory,
menu, production plan, dan penjualan dalam satu platform, dilengkapi rekomendasi _production
plan_ berbasis AI (LLM-as-advisor) dan Menu Engineering Matrix.

Dokumen ini fokus pada **modul Authentication**, karena base code sedang disusun ulang dari
awal dan fitur akan ditambahkan bertahap, modul demi modul.

## Tech Stack

| Layer                 | Teknologi                             | Alasan                                                                     |
| --------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| Runtime & Framework   | Node.js + Express                     | Standar industri untuk REST API, ekosistem matang                          |
| Database              | MongoDB + Mongoose                    | Schema fleksibel, cocok untuk iterasi cepat                                |
| Access Token          | JSON Web Token (JWT)                  | Stateless, cepat diverifikasi, mudah di-scale horizontal                   |
| Refresh Token         | Random string (opaque) + SHA-256 hash | Bisa di-_rotate_ & di-_revoke_ per sesi, tidak bisa dilakukan di JWT murni |
| Password Hashing      | bcryptjs                              | Salted hash, standar industri untuk kredensial                             |
| OTP Hashing           | crypto (SHA-256, built-in)            | OTP berumur pendek, tidak perlu cost factor bcrypt yang berat              |
| Validasi Input        | Joi                                   | Deklaratif, terpisah dari business logic                                   |
| Email Delivery        | Brevo Transactional API               | Alternatif SMTP yang tidak diblokir hosting free-tier                      |
| Security Headers      | Helmet                                | Mitigasi XSS, clickjacking, MIME sniffing                                  |
| Rate Limiting         | express-rate-limit                    | Mencegah brute-force pada endpoint login & OTP                             |
| NoSQL Injection Guard | express-mongo-sanitize                | Membersihkan operator `$` dari input user                                  |
| Logging               | Winston + Morgan                      | Log terstruktur untuk debugging di production                              |

**Prinsip arsitektur:** `Route → Middleware (validate/auth) → Controller → Service → Model`

- **Route** — definisi endpoint & middleware yang dipasang
- **Controller** — terima `req`, panggil service, kirim `res`; tanpa business logic
- **Service** — seluruh business logic, tidak bergantung pada `req`/`res`, mudah di-unit-test
- **Model** — struktur data & aturan di level database (hashing password, index, dsb.)

## Struktur Folder

```
src/
├── config/         # Load & validasi environment variables (Joi)
├── controllers/     # Terima request, panggil service, bentuk response
├── middlewares/      # authenticate, validate, rate limiter, error handler
├── models/           # Schema Mongoose (User, RefreshToken, dsb.)
├── routes/           # Definisi endpoint per modul
├── services/         # Business logic (auth, dsb.)
├── utils/            # Helper murni (hashToken, ApiError, ApiResponse, otp, mailer)
└── validations/       # Schema Joi per modul
```

## Modul: Authentication

Sejak revisi terbaru, sistem auth menggunakan pendekatan **satu sesi aktif per user**
(_single-device login_) dan **rotating refresh token**, menggantikan pendekatan refresh
token statis sebelumnya. Perubahan ini menutup dua celah utama: refresh token yang bocor
tidak bisa dipakai selamanya, dan tidak ada dua device yang bisa login bersamaan atas nama
user yang sama.

### Strategi Token

| Token             | Bentuk                            | Umur                            | Disimpan di                                           | Karakteristik                                                                              |
| ----------------- | --------------------------------- | ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Access Token**  | JWT                               | Pendek (15 menit)               | Memory di client                                      | Berisi `sub`, `role`, `tokenVersion`; divalidasi tanpa query DB kecuali cek `tokenVersion` |
| **Refresh Token** | Random string opaque (64 bytes)   | 7 hari (web) / 30 hari (mobile) | httpOnly Cookie (web) / body (mobile), hash-nya di DB | Single-use, rotasi tiap kali dipakai, dikelompokkan per `familyId`                         |
| **Reset Token**   | JWT terpisah (`JWT_RESET_SECRET`) | Sangat pendek (10 menit)        | Body request                                          | Sekali pakai, di-scope dengan `purpose` + `nonce`                                          |

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

**1. Register & Verifikasi Email**
Registrasi membuat user dengan `isEmailVerified: false` dan langsung mengirim kode OTP ke
email. Token login **belum** diterbitkan pada tahap ini — user wajib verifikasi email
terlebih dahulu lewat `verify-email/confirm` sebelum bisa login.

**2. Login — Single Session Enforcement**
Saat kredensial valid dan email terverifikasi, service memanggil `enforceSingleSession`:
seluruh refresh token aktif milik user di-_revoke_, dan `tokenVersion` user dinaikkan
sehingga access token dari device manapun yang masih aktif langsung tidak valid. Barulah
setelah itu access token dan refresh token yang baru diterbitkan untuk device yang sedang
login. Hasilnya: login dari device baru otomatis mengeluarkan device lama.

**3. Akses Endpoint Terproteksi**
Middleware `authenticate` memverifikasi signature & masa berlaku JWT, lalu membandingkan
`tokenVersion` di token dengan `tokenVersion` user di database, serta memastikan token tidak
diterbitkan sebelum `passwordChangedAt`. Ketiganya harus lolos sebelum request diteruskan ke
controller.

**4. Refresh Token — Rotasi & Deteksi Reuse**
Setiap kali `/auth/refresh` dipanggil:

- Refresh token lama dicari berdasarkan hash-nya, diklaim secara atomic (`usedAt` di-set),
  lalu ditandai sudah terpakai.
- Jika token yang sama dicoba dipakai lagi (tanda ciri pencurian token), seluruh token dalam
  `familyId` yang sama langsung di-_revoke_, memaksa user login ulang dari awal.
- Token lama digantikan oleh refresh token baru (`parentId` menunjuk ke token sebelumnya),
  dan access token baru diterbitkan dengan `tokenVersion` yang sudah dinaikkan.

**5. Logout**
Refresh token milik sesi yang sedang aktif di-_revoke_, dan `tokenVersion` dinaikkan sehingga
access token yang sedang dipegang client juga langsung tidak valid — tidak perlu menunggu
masa berlaku 15 menit habis.

**6. Forgot Password → Reset Password**
Alur tiga langkah (kirim kode → verifikasi kode → reset password) tetap menggunakan
`resetToken` terpisah yang di-scope dengan `purpose` dan `nonce` sekali pakai. Setelah
password berhasil direset, seluruh refresh token milik user di-_revoke_, memaksa login ulang
di semua device.

**7. Change Password (user sudah login)**
Sama seperti reset password, mengganti password akan menaikkan `tokenVersion` dan
me-_revoke_ seluruh refresh token — device lain otomatis ter-_logout_, device yang sedang
dipakai tetap aman karena request ini sendiri butuh access token yang masih valid.

## Environment Variables

| Variable                             | Keterangan                                              |
| ------------------------------------ | ------------------------------------------------------- |
| `JWT_ACCESS_SECRET`                  | Secret untuk sign access token (JWT)                    |
| `JWT_ACCESS_EXPIRES`                 | Masa berlaku access token (default `15m`)               |
| `JWT_REFRESH_EXPIRES`                | Referensi masa berlaku refresh token web (default `7d`) |
| `JWT_RESET_SECRET`                   | Secret khusus untuk `resetToken` forgot-password        |
| `JWT_RESET_EXPIRES`                  | Masa berlaku `resetToken` (default `10m`)               |
| `OTP_LENGTH` / `OTP_EXPIRES_MINUTES` | Konfigurasi kode OTP verifikasi email & reset password  |
| `OTP_RESEND_COOLDOWN_SECONDS`        | Cooldown sebelum OTP boleh dikirim ulang (default `60`) |
| `OTP_MAX_ATTEMPTS`                   | Batas percobaan input kode OTP sebelum diblok           |

## API Endpoints — Auth

Base path: `/api/v1/auth`

| Method | Endpoint                       | Auth | Deskripsi                                                       |
| ------ | ------------------------------ | ---- | --------------------------------------------------------------- |
| POST   | `/register`                    | –    | Registrasi user, mengirim kode verifikasi email                 |
| POST   | `/verify-email/send`           | –    | Kirim / kirim ulang kode verifikasi email                       |
| POST   | `/verify-email/confirm`        | –    | Konfirmasi kode verifikasi email                                |
| POST   | `/login`                       | –    | Login; me-_revoke_ sesi lama, menerbitkan token baru            |
| POST   | `/refresh`                     | –    | Rotasi refresh token, terbitkan access token baru               |
| POST   | `/logout`                      | –    | Revoke sesi & invalidasi access token saat ini                  |
| GET    | `/me`                          | Ya   | Ambil data user yang sedang login                               |
| PATCH  | `/change-password`             | Ya   | Ganti password; revoke semua sesi lain                          |
| POST   | `/forgot-password`             | –    | Kirim kode reset password (silent terhadap email tak terdaftar) |
| POST   | `/forgot-password/verify-code` | –    | Verifikasi kode, terbitkan `resetToken`                         |
| POST   | `/reset-password`              | –    | Reset password menggunakan `resetToken`                         |

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

## Roadmap

Modul berikut akan didokumentasikan menyusul seiring fitur ditambahkan kembali secara
bertahap ke base code baru:

- [ ] Inventory
- [ ] Menu
- [ ] Production Plan
- [ ] Selling
- [ ] Plan Report

---

<div align="center">
<sub>Dibangun oleh 505-Kada-Team — Capstone MERN Stack</sub>
</div>
