# Education Management Platform

Synthetic demo data only. Do not put real student records in this database.

## Stack

- Web: React, TypeScript, Vite, Tailwind CSS
- API: Node.js, Express, REST `/api/v1/`
- Auth: Argon2id passwords, short-lived JWT access cookie, rotating refresh cookie
- Database: PostgreSQL and Prisma

## Start

```bash
# 1. Start local PostgreSQL
docker compose up -d postgres

# 2. Configure environment files
cp .env.example .env
cp .env.example api/.env

# 3. Install dependencies
npm install --prefix api
npm install --prefix web

# 4. Run database migrations & seed demo data
npm run db:migrate --prefix api
npm run db:seed --prefix api

# 5. Start development servers
npm run dev --prefix api
npm run dev --prefix web
```

Open http://localhost:5173

### Mobile (Flutter)

```bash
cd mobile
flutter pub get
flutter run -d windows --dart-define=API_BASE=http://127.0.0.1:4000
```

Android emulator: `--dart-define=API_BASE=http://10.0.2.2:4000`

## Deployment

The platform is designed to deploy with a decoupled frontend and backend:
- **Frontend (Web):** Deployed on Vercel. Route rewrites (`web/vercel.json`) proxy `/api/*` requests to the live backend service.
- **Backend (API):** Deployed as a web service on Render (or Docker/Railway). Uses Node.js Express and Prisma connected to PostgreSQL.

### Production Environment Variables

Configure the following environment variables in your backend service hosting provider (e.g. Render Dashboard):

| Variable | Description | Example / Requirement |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@host:5432/dbname?sslmode=require` |
| `JWT_ACCESS_SECRET` | Secret key for signing access JWTs | Must be a strong, random string (min 32 characters). Server startup fails if unset. |
| `WEB_ORIGIN` | Allowed CORS origin for the frontend | `https://your-app.vercel.app` |
| `COOKIE_SECURE` | Set cookies with Secure flag (HTTPS) | `true` |
| `PORT` | Listening port for the Express API | `4000` (or assigned by host) |
| `SUPER_ADMIN_EMAIL` | Bootstrap initial super admin email | `admin@yourdomain.com` |
| `SUPER_ADMIN_PASSWORD`| Bootstrap initial super admin password| Strong password (min 8 characters) |
| `CLOUDINARY_*` | Optional photo storage credentials | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |

### Production Database Migrations

Apply pending migrations during deployment build:
```bash
npx prisma migrate deploy
```

> **Security Warning:** The demo seed data and passwords (`DemoAdmin#2026`) are strictly for local testing. Never run `npm run db:seed` against a live production database.

---

## Demo Accounts (Local Dev Only)

- Super Admin: `superadmin@demo.school` / `DemoAdmin#2026`
- School Admin (Ilays): `schooladmin.ilays@demo.school` / `DemoAdmin#2026`
- School Admin (Xaafuun): `schooladmin.xaafuun@demo.school` / `DemoAdmin#2026`
- Parent: `parent.hodan@demo.school` / `DemoAdmin#2026`
- Accountant (Ilays): `accountant.ilays@demo.school` / `DemoAdmin#2026`

Fees: school admin menu **Fees** — create fee, record payment (receipt `RCP-{school}-#####`), void/waive via API. Parents see balances under **Fees**.

Staff: school admin menu **Staff** — create `ACCOUNTANT` / `STAFF` with system IDs `STF-#####` (separate email from teachers).

Announcements: school admin publishes to audience (ALL / PARENTS / TEACHERS / STAFF…). Others read them under **Announcements** with read receipts.

Reports: role dashboards (school / teacher / accountant / parent / super admin) plus school **Reports** (fee defaulters CSV, attendance by section, alumni).

Student 360: open any student profile for Overview / Academics / Attendance / Finances / Documents / Timeline / Guardians tabs.

Documents: private school storage (PDF/JPEG/PNG/WEBP, max 10MB, magic-byte check). Verify / reject / archive from the student profile; no public URLs.

Search: school admin **Search** — students (ID/name/guardian), teachers, staff.

Audit: school admin **Audit** — recent document / announcement / payment actions.

Photos: Student 360 Overview — upload JPEG/PNG/WEBP (max 5MB). Uses Cloudinary when `CLOUDINARY_*` env vars are set; otherwise private local storage.

Super Admin: create organizations/schools, invite school admins (set-password link), activate/deactivate schools.
