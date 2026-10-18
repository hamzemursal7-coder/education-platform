# Education Management Platform

Synthetic demo data only. Do not put real student records in this database.

## Stack

- Web: React, TypeScript, Vite, Tailwind CSS
- API: Node.js, Express, REST `/api/v1/`
- Auth: Argon2id passwords, short-lived JWT access cookie, rotating refresh cookie
- Database: PostgreSQL and Prisma

## Start

```bash
docker compose up -d postgres
npm install --prefix api
npm install --prefix web
npm run db:migrate --prefix api
npm run db:seed --prefix api
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

Demo Super Admin:

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
