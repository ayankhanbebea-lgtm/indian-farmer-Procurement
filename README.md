# Smart Procurement — Digital Queue & Procurement Platform

Built for **Smart India Hackathon 2026**, Problem Statement **26032**
("Farmers often face long waiting times, lack of information regarding
procurement schedules, and uncertainty about procurement status.") —
Ministry of Consumer Affairs, Food & Public Distribution, Department of
Consumer Affairs.

A working prototype connecting **Farmers → Procurement Centres → Centre
Staff → Government/Admin**, with real farmer registration/booking, real
server-side token generation, a real queue that only advances when staff
act on it, and real procurement/payment status tracking — plus a
custom-designed UI (not a default template) built around a single
signature visual: the **Queue Rail**, a token-flow line from "now
serving" to the farmer's own grain-marked token, that recurs across the
farmer and staff screens.

**Brand**: "Smart Procurement — Less waiting. Better planning.
Transparent procurement." Deep agricultural green + navy + a grain-gold
accent (Manrope for display/tokens, Inter for body/tabular data), a
simple grain-stalk wordmark, 12–16px radii, soft shadows.

---

## 1. What's built and working end-to-end

- **Farmer**: register/login, guided booking flow (crop → quantity →
  centre → date → slot → confirm), server-generated token, live queue
  position + estimated wait time (polling, not fake realtime), booking
  history, in-app notifications, a deterministic assistant that answers
  from the farmer's own real data, profile view.
- **Staff**: live queue for their assigned centre, "Call Next Farmer",
  and a state-machine-enforced workflow (Arrived → Verified → Weighing →
  Procurement Completed → Payment Processing → Payment Completed), with
  crop weighing entry and payment amount entry.
- **Admin**: platform-wide stats, per-centre load/congestion status
  (Normal/Busy/High Load), payment status breakdown, a data-derived
  "Smart Insights" panel, and a recent-activity audit log.
- **Security**: bcrypt password hashing, JWT session cookies,
  role-protected routes enforced in `middleware.ts` (a farmer cannot
  reach `/staff` or `/admin` and vice versa) *and* re-checked server-side
  in every API route (never just hidden buttons). Staff actions are also
  scoped to their own centre — a staff account cannot act on another
  centre's booking (returns 403).
- **Demo data**: 10 farmers, 3 centres, 6 crops, bookings across every
  status (booked, arrived, weighing, completed, payment pending, paid),
  and one centre deliberately over its high-load threshold so the
  congestion detector has something to show.

This has been tested end-to-end with real HTTP requests against the
production build — not just "should work": farmer registration, booking
creation with real token generation, duplicate-booking rejection, slot
capacity, the full staff status workflow (including rejecting invalid
transitions and cross-centre access), congestion detection, and the
admin overview all returned correct results in testing.

## 2. Architecture decision: SQLite instead of Supabase

The original spec calls for Supabase/Postgres. This prototype uses
**SQLite via Node 22's built-in `node:sqlite` module** instead, for one
concrete reason: the development sandbox this was built in blocks
downloads from Prisma's binary host, so Prisma (the Postgres client)
could not install. Rather than leave the database non-functional, this
uses Node's zero-dependency built-in SQLite driver against the same
relational schema (see `prisma/schema.sql`) with hand-written SQL.

**To move to Supabase/Postgres later:** the schema in
`prisma/schema.sql` is already written in Postgres-compatible SQL. The
only file that would need rewriting is `lib/db.ts` (swap the
`node:sqlite` connection for a `@supabase/supabase-js` or `pg` client) —
every API route calls the same query helpers, so the route code itself
doesn't change. Row Level Security policies would be added at that
point, since SQLite has no RLS equivalent; in this prototype,
authorization is instead enforced entirely in the API route layer
(role checks + centre-ownership checks on every request).

## 3. Tech stack

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- `node:sqlite` (built into Node 22+) as the data layer — see above
- `bcryptjs` for password hashing, `jose` for JWT session cookies
- `zod` for request validation
- `lucide-react` for icons

## 4. Database schema

See `prisma/schema.sql`. Tables: `users`, `farmer_profiles`,
`procurement_centres`, `centre_staff`, `crops`, `slots`, `bookings`,
`queue_entries`, `payments`, `notifications`, `audit_logs`. Foreign
keys, indexes, and check constraints on status enums are all defined
there.

## 5. Running locally

```bash
npm install
cp .env.example .env      # fill in JWT_SECRET with any random string
npm run seed               # creates prisma/dev.db and seeds demo data
npm run dev                 # http://localhost:3000
```

For a production-style run:

```bash
npm run build
npm run start
```

Note: `node:sqlite` is an experimental Node API (stable behind a flag on
some Node versions) — you'll see an `ExperimentalWarning` in the
console; this is expected and harmless. Requires Node 22+.

## 6. Environment variables (`.env.example`)

```
DATABASE_URL="file:./dev.db"   # kept for continuity with the Postgres/Supabase path
JWT_SECRET=                    # required — any random string in dev; a real secret in production
AI_PROVIDER_API_KEY=           # optional — not used; see "AI features" below
SMS_PROVIDER_API_KEY=          # optional — not used; see "Notifications" below
```

The app runs fully without `AI_PROVIDER_API_KEY` or
`SMS_PROVIDER_API_KEY` set — both are seams for future integrations, not
requirements.

## 7. Demo accounts (password for all: `demo1234`)

| Role | Phone | Notes |
|---|---|---|
| Admin | 9000000001 | DoCA Admin |
| Staff | 9100000001 | Jaipur Centre 01 |
| Staff | 9100000002 | Jaipur Centre 02 — this is the SIH demo scenario centre |
| Staff | 9100000003 | Jaipur Centre 03 — seeded over its high-load threshold |
| Farmer | 9200000001 | Ramesh Kumar — the SIH demo scenario farmer, token **WHT-0247** |
| Farmer | 9200000002–9200000010 | Other seeded farmers |

New farmers can also self-register from `/register`.

## 8. SIH demo flow (matches the problem statement's judge walkthrough)

1. Login as **Ramesh Kumar** (9200000001) → home screen shows token
   **WHT-0247**, currently serving **WHT-0239**, 7 farmers ahead, ~35 min
   estimated wait.
2. Open **Live Queue** — same numbers, refreshed by polling.
3. In another browser/incognito window, login as **staff** (9100000002,
   Centre 02) → dashboard shows the same live queue.
4. Staff clicks **Call Next Farmer** → the currently-serving token
   advances. Refresh Ramesh's queue screen — his position/estimate
   updates accordingly.
5. Staff walks a booking through **Mark Arrived → Verify → Start
   Weighing → Complete Procurement** (enter actual quantity) → **Start
   Payment** (enter amount) → **Mark Paid**.
6. That farmer's **History** and **Notifications** reflect procurement
   completed and payment credited.
7. Login as **admin** (9000000001) → overview shows updated stats,
   Centre 03 flagged **High Load**, payment breakdown, and the audit log
   entry for every staff action just taken.

## 9. AI features — what's real vs. what's deterministic

Per the problem statement's own instruction not to overclaim AI:

- **Farmer assistant**: deterministic, rule-based. It reads only the
  logged-in farmer's own booking/queue/payment rows and pattern-matches
  the question (queue/token, payment, status, centre). It is not an LLM
  call. `AI_PROVIDER_API_KEY` is the seam where a real model could be
  plugged in later (see `app/api/farmer/assistant/route.ts`) — the
  context-building logic there would stay the same, only the final
  reply-generation step would change.
- **Smart centre recommendation**: deterministic scoring (queue length +
  estimated wait), explicitly labeled as rule-based, not ML.
- **Admin "Smart Insights"**: computed directly from live database
  aggregates (busiest centre, quietest centre, no-show rate) — not
  fabricated statistics, not a model.

## 10. Notifications — what's real vs. mocked

All notification types (booking confirmed, queue approaching,
procurement completed, payment processing, payment completed) are real
rows written to the `notifications` table and shown in-app, triggered
by real state changes (not a timer or fake event). No SMS is actually
sent — `SMS_PROVIDER_API_KEY` is not configured, and the code does not
claim otherwise. `lib/services.ts` → `sendNotification()` is the single
seam where a real SMS/WhatsApp gateway would be added.

## 11. What's intentionally out of scope for this prototype

Being upfront about limits rather than papering over them:

- **Hindi UI**: labels are structured for future i18n (see the plain,
  farmer-friendly English copy throughout — "Your Token" not "Queue
  Reference ID"), but full Hindi translation strings are not wired up
  yet.
- **Cancel/reschedule** for farmers is not implemented (booking
  creation, tracking, and the full staff-side lifecycle are).
- **Real government integrations** (Aadhaar, PM-KISAN, bank transfer,
  actual SMS gateway) are explicitly not implemented, per the problem
  statement's own instruction — only clean service-layer seams for them.
- **Maps**: centre distance is not shown (no real farmer geolocation in
  this prototype); centre ranking uses queue length and wait time only,
  and the recommendation UI is honest about that.
- **Staff/centre management UI for admin** (creating centres, assigning
  staff) is not built — the data model supports it, but there's no
  screen yet.
- Deployed to a **single SQLite file**, not a hosted database — fine for
  a demo, not for concurrent production traffic. See the Supabase
  migration path above.

## 12. Deployment

- **Frontend/app**: deployable to Vercel as a standard Next.js app. The
  Google Fonts `<link>` in `app/layout.tsx` is fetched by each visitor's
  browser at runtime, not during the build, so it works normally on
  Vercel even though this development sandbox's network policy blocked
  it during local builds here (harmless `ExperimentalWarning`-style
  message in the build log, not a build failure).
- **Database**: as shipped, SQLite is a local file and won't persist
  correctly on Vercel's ephemeral filesystem across deploys — for a real
  deployment, follow the Supabase migration path in section 2 first
  (swap `lib/db.ts`, point `DATABASE_URL` at a real Postgres instance,
  run the schema from `prisma/schema.sql` there).
- Run `npm run build` locally first to confirm a clean production build
  (already verified — see section 1).

## 13. UI/UX redesign notes

The interface was redesigned from a generic dashboard look to a
custom visual identity, without changing any backend logic, database
schema, or API — verified by re-running the full functional test suite
from section 1 after the redesign (same results).

- **Design tokens** live in `tailwind.config.js` (`brand`, `navy`,
  `grain`, `surface`, `ink` color scales) and `app/globals.css`
  (`.btn`, `.card`, `.panel`, `.input`, `.badge`, skeleton loaders).
  Change a token once, it propagates everywhere — no page hardcodes a
  color.
- **Signature element**: `components/QueueRail.tsx` — a horizontal
  flow line from a pulsing "NOW" marker to the farmer's own token,
  rendered as a larger grain-gold seed shape. Used at full size on
  `/farmer` and `/farmer/queue`, and echoed as a compact token strip in
  the staff dashboard's "Next up" panel.
- **Logo**: `components/Logo.tsx` — a single-color SVG grain stalk
  bending into a flow/check shape, used consistently in the navy header
  bars, sidebar, and landing page.
- **Staff/Admin shell**: `components/DashboardShell.tsx` replaces the
  old flat header — a fixed navy sidebar on desktop (≥768px), a
  horizontally-scrollable pill nav on mobile, shared by both
  `/staff` and `/admin`.
- Reusable pieces: `QueueRail`, `Timeline` (payment/procurement
  progress), `LoadIndicator` (centre congestion bar), `MetricCard`,
  `ProgressSteps` (booking flow), `EmptyState`, `Skeleton` — all in
  `components/`, none of the redesigned pages duplicate this styling
  inline.
- Verified via Playwright screenshots at 375–390px (mobile) and
  1280px (desktop) for every farmer screen, the full 6-step booking
  flow end-to-end (produced a real token), staff, and admin — checked
  for horizontal overflow (`document.body.scrollWidth` matched
  viewport width in every case tested) as well as visual correctness.
