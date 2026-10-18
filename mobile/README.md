# EMP Mobile (Flutter)

Flutter client for the Education Management Platform API.

## Run

```bash
# API must be running on :4000
cd mobile
flutter pub get
flutter run -d windows --dart-define=API_BASE=http://127.0.0.1:4000
```

Android emulator:

```bash
flutter run -d android --dart-define=API_BASE=http://10.0.2.2:4000
```

## Demo logins

Same as web (`DemoAdmin#2026`):

- `schooladmin.ilays@demo.school`
- `accountant.ilays@demo.school`
- `parent.hodan@demo.school`
- `superadmin@demo.school`

## Phase 1 scope

- Cookie session login against Express `/api/v1`
- Role home dashboards (school admin, accountant, teacher, parent, super admin)
- Matches web indigo / light theme
