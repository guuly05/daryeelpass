# DaryeelPass API

Node.js API for the DaryeelPass Hargeisa clinic directory. It serves public clinic information from PostgreSQL. It is not connected to the listed clinics' booking or patient systems and must not be used to store real patient information.

## Stack

- Node.js 20.19 or newer, JavaScript ES modules, Express 5
- PostgreSQL 17 for local development
- Prisma ORM 6 for the data model and migrations
- Signed, HTTP-only cookie sessions
- Optional local eSignet OIDC login

## Run locally

1. Copy `.env.example` to `.env` and replace `SESSION_SECRET` with a random string of at least 32 characters.
2. Start Docker Desktop, then start PostgreSQL with Docker Compose: `docker-compose up -d`.
3. Install packages: `npm install`.
4. Generate the Prisma client: `npm run db:generate`.
5. Apply checked-in database migrations: `npm run db:deploy`.
6. Seed public Hargeisa clinic directory data and local development records: `npm run db:seed`.
7. Start the API: `npm run dev`.

The API listens on `http://localhost:4000`. `GET /health` checks the database connection. Vite's development server defaults to `http://localhost:5173`, which is the configured `FRONTEND_ORIGIN`. If you use the Vite preview server on port `4173`, change `FRONTEND_ORIGIN` to that origin.

To stop the local database later, run `docker-compose down`. The named volume keeps the sample database across restarts. `docker-compose down -v` deletes that local database volume.

## Tests

- `npm run test:unit` runs database-free unit tests for token generation and appointment formatting.
- `npm test` runs unit tests and API integration tests. The integration tests need the migrated and seeded PostgreSQL database from the setup above.
- GitHub Actions runs the full suite on every push and pull request using a disposable PostgreSQL service, builds the frontend, and checks for high-severity backend dependency advisories.

## API overview

All application routes use the `/api/v1` prefix.

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/auth/session` | Public | Check the current session |
| `POST` | `/auth/demo/patient` | Local development only | Sign in as synthetic patient Ayaan |
| `POST` | `/auth/demo/staff` | Local development only | Sign in as synthetic receptionist |
| `POST` | `/auth/logout` | Session | Clear the session cookie |
| `GET` | `/clinics` | Public | List clinics, public contact details, departments, listed clinicians, and their source links |
| `GET` | `/slots` | Public | List available slots; accepts `serviceId`, `from`, and `to` |
| `GET` | `/appointments` | Patient | List the patient's upcoming appointments |
| `POST` | `/appointments` | Patient | Book a slot with `{ "slotId": "..." }` |
| `PATCH` | `/appointments/:id/cancel` | Patient | Cancel a booked appointment |
| `POST` | `/appointments/:id/pass` | Patient | Create a short-lived opaque check-in token |
| `POST` | `/staff/check-ins/verify` | Staff | Consume a token once and check in its appointment |
| `GET` | `/staff/queue?date=YYYY-MM-DD` | Staff | List today's checked-in visits for the staff member's clinic |
| `GET` | `/auth/esignet` | Public | Start the eSignet authorization-code flow |

The clinic directory is not a clinic partnership list. Appointment links open the clinic's own public website or appointment form. DaryeelPass does not receive booking confirmations or live availability.

Responses use `{ "data": ... }` on success and `{ "error": { "code", "message" } }` on failure. Slots are represented as ISO timestamps; the clinic's IANA timezone is returned alongside them.

## Security and scope notes

- Only the patient-facing app origin in `FRONTEND_ORIGIN` is allowed by CORS. Browser requests that use the session must include credentials.
- The demo uses signed, HTTP-only, same-site cookies. The cookie contains only a demo user ID and role, not identity claims.
- Demo sign-in is disabled in production, and the server refuses to start in production while `DEMO_MODE=true`.
- Check-in QR codes contain a random opaque token. Only its SHA-256 hash is stored; verification checks expiry and consumes the token in a transaction.
- eSignet client signing keys belong in the ignored `backend/.secrets/` folder and must never be put in the public PWA or committed.
- Directory clinician names and affiliations reflect clinic-published pages; they are not an independent verification of credentials or current availability.
- Do not use real patient names, national identifiers, biometrics, appointment data, or medical information in this local setup.

## Repository boundary

This directory is intended to become the separate private backend repository. Keep it outside the public frontend repository when publishing. No GitHub remote is configured here yet.
