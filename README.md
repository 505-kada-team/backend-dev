# Authentication Flow & Tech Stack — MERN Capstone

Dokumen ini menjelaskan **bagaimana dan mengapa** autentikasi di boilerplate ini dibuat
seperti sekarang, supaya tim (backend maupun frontend) punya pemahaman yang sama sebelum
mengembangkan fitur baru di atasnya.

> **Update:** dokumen ini sudah mencakup 3 fitur tambahan — verifikasi email (SMTP),
> forgot password, dan change password.

---

## 1. Tech Stack & Alasan Pemilihan

| Layer                 | Teknologi                       | Kenapa dipilih                                                               |
| --------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| Runtime               | Node.js + Express               | Standar industri untuk REST API, ekosistem besar                             |
| Database              | MongoDB + Mongoose              | Schema fleksibel, cocok untuk iterasi cepat capstone                         |
| Password hashing      | bcryptjs                        | Salted hash, tahan brute-force, standar industri                             |
| OTP hashing           | crypto (SHA-256, built-in Node) | OTP berumur pendek (menit), tidak perlu cost factor bcrypt yang berat        |
| Token                 | jsonwebtoken (JWT)              | Stateless, gampang di-scale (tidak perlu session store)                      |
| Pengiriman email      | Nodemailer + Gmail SMTP         | Gratis untuk skala capstone, App Password lebih aman dari password akun asli |
| Validasi input        | Joi                             | Deklaratif, error message rapi, dipisah dari logic                           |
| Security headers      | Helmet                          | Mencegah XSS, clickjacking, sniffing lewat header HTTP                       |
| Rate limiting         | express-rate-limit              | Mencegah brute-force login, OTP, & abuse endpoint                            |
| NoSQL injection guard | express-mongo-sanitize          | Membersihkan operator `$` dari input user                                    |
| Logging               | Winston + Morgan                | Log terstruktur, gampang di-debug di production                              |
| State management (FE) | Redux Toolkit                   | Predictable state, cocok untuk auth state global                             |

**Prinsip arsitektur:** `Route → Controller → Service → Model`

- **Route**: definisi endpoint + middleware yang dipasang
- **Controller**: terima `req`, panggil service, kirim `res` — tidak ada business logic
- **Service**: seluruh business logic, tidak tahu apa itu `req`/`res`, gampang di-unit-test
- **Model**: struktur data & aturan di level database (hashing password, dsb.)

---

## 2. Strategi Token: Kenapa Tiga Token?

Kita pakai **tiga jenis token**, bukan satu token dengan umur panjang. Ini best practice
industri karena menyeimbangkan **keamanan** dan **user experience** untuk kebutuhan yang
berbeda-beda.

| Token             | Umur                     | Disimpan di                                   | Tujuan                                                                                     |
| ----------------- | ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Access Token**  | Pendek (15 menit)        | Memory / state React (Redux)                  | Dipakai di header `Authorization: Bearer <token>` untuk akses endpoint terproteksi         |
| **Refresh Token** | Panjang (7 hari)         | httpOnly Cookie + DB (`user.refreshToken`)    | Dipakai khusus untuk minta access token baru, tidak pernah dikirim ke endpoint biasa       |
| **Reset Token**   | Sangat pendek (10 menit) | Dikirim di body request (bukan cookie/header) | Bukti "user sudah lolos verifikasi kode OTP", hanya valid untuk endpoint `/reset-password` |

**Kenapa access token umurnya pendek?**
Kalau token ini bocor (misal lewat XSS), penyerang cuma bisa pakai maksimal 15 menit.

**Kenapa refresh token disimpan di httpOnly cookie, bukan localStorage?**
`httpOnly` cookie tidak bisa diakses lewat JavaScript (`document.cookie`), jadi walaupun
ada celah XSS di frontend, refresh token tetap aman. Ini alasan utama kenapa kita **tidak**
simpan token apapun di `localStorage`.

**Kenapa refresh token juga disimpan di database (`user.refreshToken`)?**
Supaya kita bisa **mencabut (revoke)** akses kapan saja — misal saat user logout, ganti
password, atau akun dicurigai diretas, cukup hapus `refreshToken` di DB, maka refresh token
lama otomatis tidak valid lagi walau secara JWT belum expired.

**Kenapa `resetToken` dibuat terpisah dari access/refresh token?**
`resetToken` punya tujuan sangat spesifik dan sekali pakai: membuktikan bahwa pemilik
request sudah berhasil verifikasi kode OTP forgot-password. Dia sengaja **tidak** dipakai
sebagai token login karena:

- Signed dengan secret berbeda (`JWT_RESET_SECRET`), jadi tidak bisa dipakai untuk request
  ke endpoint protected lain — `authenticate` middleware akan menolaknya.
- Payload-nya menyimpan `purpose: 'reset-password'`, dicek eksplisit oleh middleware
  `verifyResetToken` supaya token ini benar-benar hanya bisa dipakai untuk aksi ini (token
  scoping).
- Bersifat **single-use**: begitu diterbitkan, sebuah `nonce` acak disimpan di
  `user.resetPasswordNonce`. Token hanya valid selama nonce di token cocok dengan nonce di
  DB — setelah dipakai sekali untuk reset password, nonce dihapus, jadi token yang sama
  tidak bisa dipakai ulang walau secara masa berlaku JWT belum habis.

**Bagaimana password yang berubah "mencabut" access token lama?**
Setiap kali password berubah (lewat reset-password maupun change-password), field
`passwordChangedAt` di-update. Middleware `authenticate` membandingkan `iat` (waktu terbit)
token dengan `passwordChangedAt` — kalau token diterbitkan _sebelum_ password berubah, token
itu ditolak meski belum expired secara teknis. Ditambah `refreshToken` di DB ikut di-clear,
sehingga user otomatis ter-logout dari semua device dan wajib login ulang.

---

## 3. Diagram Alur Lengkap

### 3.1 Register (kini otomatis kirim kode verifikasi)

```mermaid
sequenceDiagram
    participant C as Client (React)
    participant R as Route
    participant V as Validate Middleware
    participant Ctrl as Controller
    participant S as Auth Service
    participant DB as MongoDB
    participant Mail as SMTP (Nodemailer)

    C->>R: POST /api/v1/auth/register {name, email, password}
    R->>V: validate(authValidation.register)
    V-->>R: lolos / 400 Validasi gagal
    R->>Ctrl: register(req, res)
    Ctrl->>S: authService.register(body)
    S->>DB: cek email sudah ada?
    DB-->>S: tidak ada
    S->>DB: User.create() → password di-hash otomatis, isEmailVerified: false
    S->>S: sendVerificationCode(email) — reuse logic yang sama dengan endpoint send
    S->>DB: simpan hash kode OTP + expiry
    S->>Mail: kirim email berisi kode OTP
    Note over S: TIDAK generate accessToken/refreshToken di sini,<br/>karena user belum terverifikasi
    S-->>Ctrl: {user}
    Ctrl->>C: 201 {user} (tanpa token, arahkan ke halaman verifikasi)
```

### 3.2 Login (kini cek status verifikasi email)

```mermaid
sequenceDiagram
    participant C as Client
    participant Ctrl as Controller
    participant S as Auth Service
    participant DB as MongoDB

    C->>Ctrl: POST /auth/login {email, password}
    Ctrl->>S: authService.login(body)
    S->>DB: User.findOne({email}).select('+password')
    DB-->>S: user document
    S->>S: bcrypt.compare(password, user.password)
    alt password salah
        S-->>Ctrl: throw ApiError(401)
        Ctrl->>C: 401 Email atau password salah
    else password cocok tapi isEmailVerified === false
        S-->>Ctrl: throw ApiError(403, code: EMAIL_NOT_VERIFIED)
        Ctrl->>C: 403 {code: "EMAIL_NOT_VERIFIED"}
        Note over C: Frontend cek kode ini,<br/>redirect ke halaman verifikasi email
    else password cocok & email terverifikasi
        S->>S: generate accessToken & refreshToken
        S->>DB: update refreshToken
        S-->>Ctrl: {user, accessToken, refreshToken}
        Ctrl->>C: Set-Cookie refreshToken + JSON {user, accessToken}
    end
```

### 3.3 Verifikasi Email (send == resend, satu endpoint)

```mermaid
sequenceDiagram
    participant C as Client
    participant Lim as otpLimiter Middleware
    participant Ctrl as Controller
    participant S as Auth Service
    participant DB as MongoDB
    participant Mail as SMTP

    C->>Lim: POST /verify-email/send {email}
    Lim-->>C: 429 kalau lebih dari 10x/10menit
    Lim->>Ctrl: lolos rate limit
    Ctrl->>S: sendVerificationCode(email)
    S->>DB: cek cooldown resend (default 60 detik)
    alt masih cooldown
        S-->>Ctrl: throw ApiError(429, "tunggu X detik")
    else boleh kirim
        S->>S: generate kode OTP 6 digit, hash (SHA-256)
        S->>DB: simpan hash + expiry (10 menit) + reset attempts counter
        S->>Mail: kirim email kode OTP
        S-->>Ctrl: OK
    end
    Ctrl->>C: 200 "Kode verifikasi telah dikirim"

    C->>Ctrl: POST /verify-email/confirm {email, code}
    Ctrl->>S: confirmVerificationCode(email, code)
    S->>DB: bandingkan hash(code) dengan tersimpan
    alt kode salah
        S->>DB: increment emailVerificationAttempts
        S-->>Ctrl: throw ApiError(400, "kode tidak valid")
    else kode benar & belum expired & attempts < max
        S->>DB: isEmailVerified = true, hapus field kode
        S-->>Ctrl: OK
    end
    Ctrl->>C: 200 "Email berhasil diverifikasi"
```

### 3.4 Akses Endpoint Terproteksi (kini cek `passwordChangedAt`)

```mermaid
sequenceDiagram
    participant C as Client
    participant M as authenticate Middleware
    participant Ctrl as Controller

    C->>M: GET /auth/me\nHeader: Authorization: Bearer <accessToken>
    M->>M: jwt.verify(token, JWT_ACCESS_SECRET)
    alt token invalid/expired
        M->>C: 401 Token tidak valid / kedaluwarsa
    else token valid
        M->>M: User.findById(decoded.sub)
        M->>M: bandingkan decoded.iat vs user.passwordChangedAt
        alt token diterbitkan sebelum password berubah
            M->>C: 401 "Password baru saja diubah, silakan login ulang"
        else token masih sah
            M->>Ctrl: next() dengan req.user terisi
            Ctrl->>C: 200 data user
        end
    end
```

### 3.5 Refresh Token (saat access token expired)

```mermaid
sequenceDiagram
    participant C as Client (axios interceptor)
    participant Ctrl as Controller
    participant S as Auth Service
    participant DB as MongoDB

    C->>Ctrl: Request ke endpoint apapun → dapat 401 (access token expired)
    Note over C: axios interceptor menangkap 401,<br/>otomatis panggil endpoint refresh
    C->>Ctrl: POST /auth/refresh (cookie refreshToken terkirim otomatis)
    Ctrl->>S: authService.refresh(refreshToken dari cookie)
    S->>S: jwt.verify(refreshToken, JWT_REFRESH_SECRET)
    S->>DB: cocokkan dengan user.refreshToken di DB
    alt cocok & valid
        S->>S: generate accessToken baru
        S-->>Ctrl: {accessToken}
        Ctrl->>C: 200 {accessToken baru}
        Note over C: axios otomatis retry request asli<br/>dengan accessToken baru
    else tidak cocok / expired
        S-->>Ctrl: throw ApiError(401)
        Ctrl->>C: 401 → redirect ke halaman login
    end
```

### 3.6 Forgot Password — Langkah 1: Kirim Kode

```mermaid
sequenceDiagram
    participant C as Client
    participant Lim as otpLimiter Middleware
    participant Ctrl as Controller
    participant S as Auth Service
    participant DB as MongoDB
    participant Mail as SMTP

    C->>Lim: POST /forgot-password {email}
    Lim->>Ctrl: lolos rate limit
    Ctrl->>S: forgotPassword(email)
    S->>DB: User.findOne({email})
    alt email tidak ditemukan
        Note over S: SILENT RETURN — tidak throw error apapun,<br/>mencegah user enumeration
    else email ditemukan & tidak dalam cooldown
        S->>S: generate kode OTP, hash
        S->>DB: simpan hash + expiry
        S->>Mail: kirim email kode reset
    end
    Ctrl->>C: 200 "Jika email terdaftar, kode telah dikirim"
    Note over C: Response SELALU sama persis,<br/>tidak bisa dibedakan email ada/tidak
```

### 3.7 Forgot Password — Langkah 2: Verifikasi Kode → Terbitkan `resetToken`

```mermaid
sequenceDiagram
    participant C as Client
    participant Lim as otpLimiter Middleware
    participant Ctrl as Controller
    participant S as Auth Service
    participant DB as MongoDB

    C->>Lim: POST /forgot-password/verify-code {email, code}
    Lim->>Ctrl: lolos rate limit
    Ctrl->>S: verifyResetCode(email, code)
    S->>DB: bandingkan hash(code) dengan resetPasswordCode tersimpan
    alt kode salah / expired / attempts habis
        S-->>Ctrl: throw ApiError(400/429)
        Ctrl->>C: error, minta kode baru
    else kode benar
        S->>S: generate nonce acak
        S->>DB: hapus resetPasswordCode, simpan resetPasswordNonce
        S->>S: sign resetToken {sub, purpose: 'reset-password', nonce}, exp 10 menit
        S-->>Ctrl: {resetToken}
        Ctrl->>C: 200 {resetToken}
        Note over C: resetToken disimpan sementara di React state,<br/>BUKAN di localStorage/Redux persist
    end
```

### 3.8 Forgot Password — Langkah 3: Reset Password dengan `resetToken`

```mermaid
sequenceDiagram
    participant C as Client
    participant V as Validate Middleware
    participant RT as verifyResetToken Middleware
    participant Ctrl as Controller
    participant S as Auth Service
    participant DB as MongoDB

    C->>V: POST /reset-password {resetToken, newPassword}
    V-->>C: 400 kalau newPassword < 8 karakter
    V->>RT: lolos validasi
    RT->>RT: jwt.verify(resetToken, JWT_RESET_SECRET)
    RT->>RT: cek payload.purpose === 'reset-password'
    RT->>DB: User.findById(decoded.sub), bandingkan nonce
    alt token invalid/expired/purpose salah/nonce tidak cocok
        RT->>C: 401 "Reset token tidak valid / sudah dipakai"
    else lolos semua pengecekan
        RT->>Ctrl: next() dengan req.resetUser terisi
        Ctrl->>S: resetPassword(req.resetUser, newPassword)
        S->>DB: set password baru (di-hash via pre-save hook)
        S->>DB: hapus resetPasswordNonce (consume, single-use)
        S->>DB: refreshToken = null (paksa logout semua device lama)
        S-->>Ctrl: OK
        Ctrl->>C: 200 "Password berhasil direset, silakan login ulang"
    end
```

### 3.9 Change Password (user sudah login)

```mermaid
sequenceDiagram
    participant C as Client
    participant M as authenticate Middleware
    participant V as Validate Middleware
    participant Ctrl as Controller
    participant S as Auth Service
    participant DB as MongoDB

    C->>M: PATCH /auth/change-password\nHeader: Bearer <accessToken>\n{oldPassword, newPassword}
    M->>V: req.user terisi, lolos autentikasi
    V-->>C: 400 kalau newPassword sama dengan oldPassword (dicek via Joi.ref)
    V->>Ctrl: lolos validasi
    Ctrl->>S: changePassword(req.user._id, oldPassword, newPassword)
    S->>DB: User.findById(id).select('+password')
    S->>S: bcrypt.compare(oldPassword, user.password)
    alt oldPassword salah
        S-->>Ctrl: throw ApiError(401, "Password lama tidak sesuai")
    else oldPassword benar tapi newPassword sama dengan lama
        S-->>Ctrl: throw ApiError(400, "Password baru tidak boleh sama")
    else valid
        S->>DB: set password baru, refreshToken = null
        S-->>Ctrl: OK
        Ctrl->>C: 200 "Password berhasil diubah, silakan login ulang di device lain"
    end
```

### 3.10 Logout

```mermaid
sequenceDiagram
    participant C as Client
    participant M as authenticate Middleware
    participant Ctrl as Controller
    participant DB as MongoDB

    C->>M: POST /auth/logout\nHeader: Authorization: Bearer <accessToken>
    M->>Ctrl: next() dengan req.user
    Ctrl->>DB: User.findByIdAndUpdate(userId, {refreshToken: null})
    Ctrl->>C: clearCookie('refreshToken') + 200 Logout berhasil
    Note over C: Redux state auth di-reset,<br/>redirect ke halaman login
```

---

## 4. Mapping Kode per Langkah

| Langkah                                   | File yang terlibat                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Validasi input                            | `src/validations/auth.validation.js` → `src/middlewares/validate.middleware.js`       |
| Hash password otomatis                    | `src/models/user.model.js` (`pre('save')` hook, juga update `passwordChangedAt`)      |
| Generate token (access/refresh)           | `src/services/auth.service.js` (`generateAccessToken`, `generateRefreshToken`)        |
| Verifikasi token di endpoint terproteksi  | `src/middlewares/auth.middleware.js` (kini juga cek `passwordChangedAt`)              |
| Generate & hash kode OTP                  | `src/utils/otp.js`                                                                    |
| Kirim email (verifikasi & reset)          | `src/utils/mailer.js` (Nodemailer)                                                    |
| Rate limit khusus endpoint OTP            | `src/middlewares/otpLimiter.middleware.js`                                            |
| Verifikasi `resetToken` (purpose + nonce) | `src/middlewares/verifyResetToken.middleware.js`                                      |
| Logic verifikasi email                    | `src/services/auth.service.js` (`sendVerificationCode`, `confirmVerificationCode`)    |
| Logic forgot/reset password               | `src/services/auth.service.js` (`forgotPassword`, `verifyResetCode`, `resetPassword`) |
| Logic change password                     | `src/services/auth.service.js` (`changePassword`)                                     |
| Format response konsisten                 | `src/utils/ApiResponse.js`                                                            |
| Semua error (401/400/409/429/dst)         | `src/utils/ApiError.js` → ditangkap `src/middlewares/error.middleware.js`             |

---

## 5. Kenapa Ini "Scalable"?

1. **Stateless access token** → server tidak perlu simpan session di memory, jadi backend
   bisa di-scale horizontal (banyak instance) tanpa perlu sticky session atau shared session store.
2. **Service layer terpisah dari controller** → logic auth bisa di-reuse (misal dipanggil
   dari webhook atau CLI script) dan gampang di-unit-test tanpa perlu mock `req`/`res`.
3. **Refresh token per-user tersimpan di DB** → gampang ditambah fitur "logout dari semua
   device" atau "lihat device yang login" nanti, tinggal ubah `refreshToken` jadi array.
4. **Role-based authorization** (`authorize('admin')`) sudah siap dipakai untuk fitur
   admin-only tanpa restrukturisasi.
5. **Validasi & error handling terpusat** → menambah endpoint baru tidak menambah
   kompleksitas exponensial, semua endpoint baru tinggal ikut pola yang sama.
6. **Pola OTP & token scoping bisa dipakai ulang** → `resetToken` dengan `purpose` claim
   dan single-use nonce adalah pola generik. Kalau nanti butuh fitur lain yang mirip (misal
   "konfirmasi hapus akun", "undang anggota tim"), tinggal reuse pola yang sama tanpa
   desain ulang dari nol.
7. **`send`/`resend` disatukan jadi satu endpoint** dengan cooldown di level service →
   mengurangi jumlah endpoint yang perlu di-maintain dan dites, tanpa mengorbankan fitur.

---

## 6. Yang Perlu Diperhatikan Frontend

### Auth dasar (login/register/refresh)

- Simpan `accessToken` **di Redux state saja** (in-memory), jangan di `localStorage`.
- Refresh token **otomatis terkirim** oleh browser lewat cookie, frontend tidak perlu
  pegang/kirim manual refresh token — cukup pastikan `withCredentials: true` di axios
  dan `credentials: 'include'` kalau pakai fetch.
- Pasang **axios response interceptor**: kalau dapat 401, panggil `/auth/refresh`,
  kalau berhasil retry request asli, kalau gagal redirect ke `/login`.
- Setelah refresh browser (F5), `accessToken` di Redux akan hilang (karena in-memory) —
  perlu mekanisme "silent refresh" saat aplikasi pertama kali load, dengan memanggil
  `/auth/refresh` sekali di awal untuk dapat access token baru dari refresh token cookie.

### Verifikasi email

- Setelah register sukses, langsung arahkan ke halaman "Masukkan kode verifikasi"
  (jangan ke dashboard, karena backend belum menerbitkan token login).
- Saat login mendapat response `403` dengan `code: "EMAIL_NOT_VERIFIED"`, redirect ke
  halaman verifikasi yang sama, boleh auto-trigger `POST /verify-email/send` sekali.
- Tombol "Kirim ulang kode" cukup panggil endpoint `send` yang sama (bukan endpoint
  terpisah) — tampilkan countdown di frontend mengikuti `OTP_RESEND_COOLDOWN_SECONDS`
  (default 60 detik) supaya user tidak spam klik sebelum backend menolak dengan 429.

### Forgot password (3 langkah, state di React saja)

- Buat 3 halaman/step dalam satu flow: input email → input kode OTP → input password baru.
- Simpan `resetToken` hasil dari langkah 2 di **state React lokal** (misal `useState` di
  komponen induk step, atau state management sementara), **jangan** simpan di
  `localStorage` atau Redux persist — umurnya cuma 10 menit dan sekali pakai.
- `resetToken` dikirim di **body** request ke `/reset-password`, bukan di header
  `Authorization`, karena bukan token login.
- Setelah reset-password sukses, jangan asumsikan user otomatis login — arahkan ke
  halaman login karena semua refresh token lama sudah di-invalidate backend.

### Change password (protected, beda dari forgot password)

- Endpoint ini butuh `accessToken` yang valid (halaman ini ada di dalam area yang sudah
  login, misal `/settings/security`).
- Setelah sukses, backend meng-clear `refreshToken` di DB — tampilkan pesan bahwa device
  lain akan otomatis ter-logout, lalu tetap biarkan user di device saat ini (access token
  yang sedang dipakai masih tervalidasi sampai expired 15 menit atau sampai axios
  interceptor melakukan refresh berikutnya, tergantung kapan `passwordChangedAt` dicek).
  Untuk UX yang paling aman & konsisten, disarankan tetap redirect ke halaman login supaya
  user langsung dapat access token baru yang bersih.
