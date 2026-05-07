# Salon Booking App — Full Product & Architecture Specification (MVP v1)


## 1. Overview


Single-salon booking system for a hair salon with:
- max ~3 barbers
- mobile-first client app
- admin + barber management in same app
- Firebase backend


Goal: fast MVP, simple infra, correct scheduling logic.


---


## 2. Tech Stack


### Mobile
- React Native (Expo)
- TypeScript


### Backend
- Firebase Auth
- Firestore
- Cloud Functions
- Firebase Cloud Messaging
- Cloud Scheduler (for retention cleanup + reminders)


### Admin UI
- Inside same React Native app
- Role-based access


No separate web dashboard.


---


## 3. Roles


- client
- barber
- admin


Admins manage everything.
Barbers manage their schedule.
Clients book appointments.


---


## 4. Authentication


Client + barber + admin all use Firebase Auth.

v1 methods:
- Email + password
- Google sign-in

Optional / later:
- Phone (SMS OTP)

Note: shipping Google sign-in on iOS will require Apple Sign-In to pass App Store review.

Role stored in `users/{uid}.role`. Cloud Functions enforce role-based access.


---


## 5. Services


Each service has:
- name
- price
- duration (minutes)


Example:
- Haircut = 30 min
- Beard = 30 min
- Facial = 60 min


Total booking duration = sum of selected services.


No buffer time.


All services in one appointment are performed by the same barber.


---


## 6. Slot System


- slot granularity = 30 minutes


Example:
09:00, 09:30, 10:00...


Slots are NOT stored in DB — generated dynamically by `getAvailableSlots`.

Slot *claims* (one doc per claimed 30-min slot) ARE stored — see §10 for the race-condition strategy.


---


## 7. Working Hours


Admins define per barber:
- working hours per day
- multiple blocks allowed


Example:
- 09:00–12:00
- 13:00–17:00


All times are stored as local wall-clock + the salon's hardcoded timezone (see §22). No per-user / per-region timezone handling in v1.


---


## 8. Breaks


Breaks:
- defined per barber/day
- example: 12:00–13:00


IMPORTANT:
Breaks are NOT shown in UI.
They only block availability internally.


---


## 9. Scheduling Model


Available time =


  working hours
  - breaks
  - appointments
  - time off


Then split into 30-min slots.


### Slot Validity Rules

A slot is valid if:
- inside working hours
- does not overlap break
- does not overlap appointment
- fits full service duration (all consecutive 30-min slots needed must be valid)


---


## 10. Booking Race-Condition Strategy


To prevent two clients booking the same slot at the same instant:

**Each 30-min slot is represented by a deterministic doc ID.**

Format: `slotClaims/{barberId}_{YYYY-MM-DDTHH:mm}`
Example: `slotClaims/barber123_2026-05-07T0900`

`createAppointment` runs as a Firestore transaction:
1. For an N-minute service, compute the M = N / 30 consecutive slot IDs starting at the requested time.
2. Inside the transaction, attempt to *create* all M slot-claim docs.
3. If any already exists → transaction fails, client retries with new selection.
4. On success, also write the appointment doc referencing those slot claim IDs.

Atomic, no read-modify-write race. Slot claim docs are deleted on cancellation or via the retention job.


---


## 11. Booking Flow


1. Select barber (specific barber required — no "any barber" option in v1)
2. Select services
3. Select date (max 14 days ahead — see §22 settings)
4. Select time
5. Confirm booking


Progressive single flow (not strict wizard).

If a date has zero available slots, show empty state + a "next available: <date>" link that runs `getAvailableSlots` for subsequent days until a hit.


---


## 12. Booking Limits


- A client may hold at most **2 active appointments per day** (anti-abuse / anti-fake-booking).
- Booking horizon: 14 days ahead, configurable in `settings`.


---


## 13. Cancellation Rules


- allowed until 1 hour before appointment
- after that → blocked


Applies to:
- cancel
- reschedule (which is cancel + create)

Cancellation window is configurable in `settings`.


---


## 14. Rescheduling


- cancel + create new
- must pass same validation rules
- same 1-hour window applies — cannot reschedule a same-day appointment under 1h out


---


## 15. Admin / Walk-in Bookings


Admin can create appointments on behalf of clients (phone bookings, walk-ins).

Two modes:
- **Registered client**: admin selects an existing user → appointment links to their `clientId`.
- **Guest**: admin enters name + phone → appointment stores `guestClient: { name, phone }` instead of `clientId`. No user record is created.

Admin bookings are also auto-confirmed and bypass the 2-per-day client limit (admin discretion).


---


## 16. Chat


Simple per-appointment chat:
- thread is bound to a single appointment (clientId ↔ barberId)
- both client and barber can send text messages
- thread becomes read-only after appointment is `completed`, `cancelledByClient`, `cancelledByAdmin`, or `noShow`
- no general messaging system, no group chat, no media uploads in v1


---


## 17. Notifications


**Channel**: FCM push only.

Events:
- booking confirmation
- cancellation (by either side)
- reminder — 60 min before appointment start (matches the cancellation window — nudges commitment)
- new chat message

**Fallback for users who deny push permission**: in-app notifications screen with unread badge. The inbox is the source of truth; push is best-effort delivery.


---


## 18. Statuses


- confirmed
- completed
- cancelledByClient
- cancelledByAdmin
- noShow

`pending` is intentionally NOT used — successful Cloud Function write goes straight to `confirmed`.

`noShow` is set manually by admin or barber. No auto-flip cron in v1.


---


## 19. Firestore Collections


- `users` — uid, name, phone, role, fcmToken, createdAt
- `barbers` — barber profile (displayName, avatar, services they perform)
- `services` — name, price, durationMinutes
- `appointments` — see §20
- `workingHours` — `{barberId}_{dayOfWeek}` blocks
- `breaks` — per barber + date
- `timeOffs` — per barber, ranges
- `slotClaims` — see §10 (deterministic IDs)
- `messages` — chat per appointment
- `blockedUsers` — see §23
- `notifications` — per user inbox (in-app fallback for §17)
- `settings` — see §22


---


## 20. Appointment Model


```
{
  id,
  clientId,           // null if guest
  guestClient,        // { name, phone } — null if registered client
  barberId,
  serviceIds,
  startAt,
  endAt,
  durationMinutes,
  status,
  slotClaimIds,       // for cleanup on cancel
  createdAt,
  createdBy,          // uid of creator (client self-book OR admin)
  deleteAt            // startAt + 31 days, used by retention job
}
```


---


## 21. Backend Functions


### getAvailableSlots
Input: barberId, date, serviceDurationMinutes
Output: list of valid 30-min start times for that day.

### createAppointment
- validate role + booking horizon + 2-per-day limit (skipped for admin)
- transactionally create all slot claim docs + appointment doc (see §10)
- on success → send confirmation push + write to recipient's `notifications` inbox

### cancelAppointment
- validate cancellation window
- delete slot claims + update appointment status
- send push + inbox notification

### rescheduleAppointment
- validate cancellation window on the existing appointment
- validate new slot via the same transaction logic as createAppointment
- atomic: cancel old + create new (or fail both)

### updateWorkingHours / updateBreaks
- before write, query existing appointments in the affected range
- if any conflict → reject with the conflict list (admin must cancel/reschedule those first)

### blockUser / unblockUser
- admin only
- writes to `blockedUsers`. `createAppointment` rejects if the requesting client is blocked.

### markNoShow / markCompleted
- admin or barber sets terminal status

### exportClientHistory
- callable function, returns the user's full appointment history as JSON before retention deletes it (see §24)

### Scheduled jobs (Cloud Scheduler)
- **reminders** — every ~5 min, find appointments starting in 55–65 min that haven't been reminded yet, send push.
- **retention cleanup** — daily, batch-delete `appointments` and related `messages` / `slotClaims` where `deleteAt < now`.


---


## 22. Settings Doc


Single doc, admin-editable:
- salonName
- address
- phone
- contactEmail
- timezone (hardcoded for now, but stored here so it's not buried in code)
- bookingHorizonDays (default 14)
- cancellationWindowHours (default 1)
- defaultWorkingHoursTemplate — used when admin creates a new barber so they don't fill from scratch


---


## 23. Blocked Users


- `blockedUsers/{uid}` document, fields: `blockedAt`, `blockedBy`, `reason`
- Admin manages from a screen in the admin UI.
- `createAppointment` rejects if the requesting clientId is in `blockedUsers`.
- Does not affect chat on existing appointments (those keep working until the appointment terminates normally).


---


## 24. Data Retention


- Appointments are auto-deleted **31 days after `startAt`**.
- Related `messages` and `slotClaims` are deleted alongside.
- Daily Cloud Scheduler job batches the deletion.
- Clients can call `exportClientHistory` to download their own history as JSON before deletion.

Rationale: minimize stored personal data per the salon owner's preference. 31 days covers the typical "monthly client" cycle so "book again from history" still works for the common case.


---


## 25. Security Rules


- clients cannot directly write `appointments`, `slotClaims`, `workingHours`, `breaks`, `timeOffs`, `blockedUsers`, or `settings`
- all booking + admin operations go through Cloud Functions
- clients can read only their own `appointments`, `messages`, `notifications`, `users/{ownUid}`
- barbers can read appointments where `barberId == their uid` and the messages threads on those appointments
- admins can read/write everything


---


## 26. Time Handling


- All timestamps stored in UTC.
- Salon timezone is hardcoded (in `settings` doc + a constant). Working hours / breaks are interpreted in salon-local time, then converted to UTC for storage.
- Frontend always renders in salon-local time (not the device's tz) to avoid confusion when a client travels.


---


## 27. UX Rules


- Breaks are NOT visible to clients.
- Users only see available slots.
- Empty date → "next available: <date>" suggestion.


---


## 28. Core Design Principles


- interval-based scheduling
- deterministic backend logic
- no pre-generated slots (claims are created at booking time, not ahead)
- Firebase-first architecture
- single codebase
- role-based UI


---


## 29. Future Features


- Google Calendar sync
- payments
- deposits
- loyalty system
- reviews
- analytics
- "any barber" booking option
- Apple Sign-In (required for App Store if Google sign-in ships on iOS)
- SMS / WhatsApp / email notifications
- Anonymized long-term analytics records (PII stripped, kept past 31 days)


---


## 30. Implementation Phases

Tracked here so progress is visible in the spec itself. `[x]` = complete, `[ ]` = pending.

- [x] **Phase 1 — Project scaffolding**
  - [x] Expo TypeScript app under `app/mobile/`
  - [x] Cloud Functions TypeScript project under `app/functions/`
  - [x] Shared types package under `app/shared/`
  - [x] Root tsconfig + scripts wired so typecheck runs across all three
- [x] **Phase 2 — Firestore schema + rules**
  - [x] Type definitions for every collection in §19
  - [x] `firestore.rules` matching §25
  - [x] `firestore.indexes.json` skeleton
- [x] **Phase 3 — Cloud Functions**
  - [x] `getAvailableSlots`
  - [x] `createAppointment` (with deterministic slot-claim transaction)
  - [x] `cancelAppointment`
  - [x] `rescheduleAppointment`
  - [x] `updateWorkingHours` / `updateBreaks` (conflict-blocking)
  - [x] `blockUser` / `unblockUser`
  - [x] `markNoShow` / `markCompleted` (combined as `markStatus`)
  - [x] `exportClientHistory`
  - [x] Scheduled job: reminders (60-min push)
  - [x] Scheduled job: retention cleanup (31-day delete)
  - [x] Bonus: `nextAvailable` to support empty-state UX
- [x] **Phase 4 — Mobile foundation**
  - [x] Firebase init (Auth + Firestore + Functions + Messaging)
  - [x] Theme + design tokens from `design.png`
  - [x] Navigation skeleton (role-based root)
  - [x] Auth screens (email+password, Google)
- [x] **Phase 5 — Client booking flow**
  - [x] Welcome / Home
  - [x] Select Barber
  - [x] Select Services
  - [x] Select Date (14-day horizon)
  - [x] Select Time (uses `getAvailableSlots`; empty state with next-available link)
  - [x] Confirm Booking
  - [x] Booking Confirmed
- [x] **Phase 6 — Client appointments**
  - [x] My Appointments list
  - [x] Appointment Details
  - [x] Cancel + reschedule (1-hour rule mirrored client-side)
- [x] **Phase 7 — Chat**
  - [x] Per-appointment thread screen
  - [x] Read-only state after appointment terminates
- [x] **Phase 8 — Notifications**
  - [x] FCM token registration
  - [x] In-app notifications inbox + badge
- [x] **Phase 9 — Barber UI**
  - [x] My Schedule
  - [x] Appointment Details (mark noShow / completed)
  - [x] Working hours / breaks management
- [x] **Phase 10 — Admin UI**
  - [x] Dashboard
  - [x] Manage Appointments
  - [x] Manage Barbers / Services / Settings
  - [x] Block / unblock users
  - [x] Create appointment on behalf of client (registered or guest)
