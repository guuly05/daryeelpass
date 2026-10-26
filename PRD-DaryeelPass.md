# PRD: DaryeelPass Clinic Check-In

**Status:** Draft v0.2  
**Product type:** Personal project with a patient-facing progressive web app (PWA)  
**Identity integration:** MOSIP Collab sandbox through eSignet  
**Initial owner:** Solo builder  
**Audience:** Builder, early users, potential clinic partners

## 1. Product summary

DaryeelPass helps a patient confirm a clinic appointment and check in without repeating basic identity details at the front desk. The patient uses a Somali- and English-language PWA, signs in through eSignet, consents to share the small set of identity claims the prototype needs, chooses or confirms an appointment, and receives a short-lived QR check-in token. Reception staff use a separate web view to scan the token and update the visit queue.

The prototype demonstrates how a service provider can use MOSIP/eSignet for identity authentication. It is **not** a national identity system, electronic medical record, or production patient-identification service.

## 2. Problem

Clinic visitors may need to repeat identifying information at arrival, and reception staff may have to search manually for an appointment. This can slow check-in and create avoidable data-entry errors.

The personal project will test whether consent-based digital sign-in and a simple check-in token can make appointment arrival easier for patients and reception staff. The longer-term ambition is to validate the workflow with clinics and grow it only if it solves a real operational problem.

## 3. Target users

- **Patient:** wants to confirm a visit and check in quickly, including on a low-end phone.
- **Receptionist:** needs to verify that a check-in token belongs to an expected appointment and move the visit through the queue.
- **Project owner / demo administrator:** prepares sample clinics, services, and appointments during the personal-project phase.
- **Potential clinic partner:** helps validate real appointment and reception workflows before any pilot.

## 4. Goals and non-goals

### Goals

1. Demonstrate eSignet login and consent in MOSIP Collab, if relying-party access is available; provide a clearly labeled mock login while integration access is pending.
2. Let a patient confirm or book a sample appointment.
3. Issue a QR code that resolves to a non-sensitive, expiring check-in token.
4. Let staff scan the token, confirm the appointment, and mark the patient as checked in.
5. Minimize identity data stored by the app and use synthetic data in the demo.

### Non-goals for the MVP

- Storing diagnoses, prescriptions, test results, or other medical records.
- Issuing national identity numbers or making identity eligibility decisions.
- Biometric capture or verification.
- Processing payments, insurance, or benefit eligibility.
- Replacing clinic scheduling or electronic medical record systems.
- Production use with real patients or real MOSIP credentials.

## 5. MVP user journeys

### Patient

1. Open the installable PWA and choose Somali or English; remember the preference on the device.
2. Select **Sign in with eSignet**.
3. Complete the eSignet authentication and consent screens.
4. Return to DaryeelPass with only the approved claims needed for the appointment.
5. Confirm a seeded appointment, or select a clinic, service, date, and available time.
6. See an appointment confirmation and QR check-in token.
7. At arrival, show the QR code to reception.

### Receptionist

1. Sign in to the staff demo view.
2. Scan a patient’s QR code (with manual short-code entry as a fallback).
3. See only the minimum details needed to match the appointment, such as a display name, service, and appointment time.
4. Mark the appointment checked in.
5. See the visit move into the clinic’s waiting queue.

### Project owner / demo administrator

1. Load sample clinics, services, and appointment slots.
2. View a basic daily appointment and check-in count.
3. Reset the demo data.

## 6. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | The app must offer eSignet sign-in using an approved Collab relying-party/OIDC client. | Must |
| FR-2 | The app must request consent before using any profile claims. | Must |
| FR-3 | The app must support a clearly labeled mock sign-in mode if Collab onboarding is unavailable during development. | Must |
| FR-4 | A patient must be able to confirm a seeded appointment or book an available sample slot. | Must |
| FR-5 | The app must generate a random, non-identifying QR token with an expiry; the QR must not contain a national ID or raw profile data. | Must |
| FR-6 | Staff must be able to scan the QR token or enter its fallback short code. | Must |
| FR-7 | Staff must be able to mark a valid appointment checked in and see its queue status. | Must |
| FR-8 | The app must prevent a token from checking in more than once and show a clear expired/invalid message. | Must |
| FR-9 | The patient must be able to view appointment details and cancel a sample appointment. | Should |
| FR-10 | The staff view should show a daily count of booked, checked-in, and completed visits. | Should |
| FR-11 | The patient experience must be installable as a PWA and work on common phone and desktop widths. | Must |
| FR-12 | Patient-facing text must be available in Somali and English, with a visible language switch. | Must |
| FR-13 | The PWA should cache its app shell and static help content for repeat visits on weak connections, while avoiding storage of sensitive identity claims or live check-in tokens in the cache. | Should |
| FR-14 | The app must clearly explain that signing in and live appointment/check-in actions require a network connection. | Must |

## 7. Identity and data handling

- eSignet performs authentication; DaryeelPass is the relying-party service.
- Request only the claims needed for the demo. Prefer a stable, app-generated patient reference over storing a national identifier.
- Obtain and record user consent before using returned claims.
- Keep identity claims separate from appointment details where practical.
- QR codes contain a random token only. The server maps the token to a demo appointment and enforces expiry and one-time use.
- Provide a clear sign-out and demo-data reset.
- Store language preference locally; do not put identity claims, appointment details, or check-in tokens in general-purpose offline caches.
- Use synthetic names, contact details, and appointments. Do not collect real health or identity data.
- For a real deployment, obtain the appropriate country/system-owner approvals and complete security, privacy, legal, and operational review before handling real identities or patient visits.

## 8. Proposed screens

1. **Welcome / language selection** — Somali/English selection, product explanation, and sign-in.
2. **eSignet return / consent status** — confirms sign-in and what data was shared.
3. **Appointments** — upcoming appointment, or booking form.
4. **Appointment confirmation** — clinic, service, time, QR token, and expiry.
5. **Staff sign-in / demo access** — a separate staff-only route for the prototype.
6. **Scan check-in** — camera scanner plus manual code entry.
7. **Staff queue** — checked-in patients and status controls.
8. **Admin demo setup** — sample data loading/reset and simple daily totals.

## 9. Suggested implementation

### Architecture

- **Frontend:** React + Vite in JavaScript; patient app installable as a PWA using a service worker and web app manifest.
- **Localization:** a JavaScript i18n library with Somali and English translation files; ask a fluent Somali speaker to review every patient-facing phrase before a clinic pilot.
- **Backend:** Node.js + Express REST API in JavaScript.
- **Database:** PostgreSQL from the start, so the data model supports multiple users and clinics as the project grows.
- **Database access:** use a migration-backed ORM such as Prisma or Sequelize; keep schema changes versioned.
- **Identity:** eSignet OIDC authorization-code flow configured as a relying party. Keep client credentials and signing keys on the server; never embed secrets in browser code.
- **QR:** opaque random token, stored hashed or otherwise protected server-side, with an expiry and single-use state.
- **Demo mode:** a switchable mock OIDC identity provider path, clearly marked as mock, to keep development moving if sandbox onboarding or uptime blocks integration.
- **PWA offline behavior:** cache only the app shell, icons, and static help/language resources. Do not promise offline identity verification, booking, or QR check-in in the MVP.

### Main data records

- `Clinic`: id, name, location label, active services.
- `AppointmentSlot`: id, clinic id, service, start time, capacity.
- `Appointment`: id, app-generated patient reference, slot id, status.
- `CheckInToken`: token hash, appointment id, expires at, used at.
- `AuditEvent`: event type, appointment reference, timestamp; avoid logging identity claims or raw tokens.

### Suggested API routes

- `GET /auth/login` and `GET /auth/callback` — start and complete eSignet login.
- `GET /api/appointments/me` — list current demo user appointments.
- `GET /api/slots` — list available sample slots.
- `POST /api/appointments` — book or confirm a slot.
- `POST /api/appointments/{id}/check-in-token` — create expiring QR token.
- `POST /api/check-in/verify` — validate and consume token for staff.
- `GET /api/staff/queue` — list today's check-ins.

## 10. Dependencies and risks

- **Collab access/client setup:** the app needs a relying-party client and permitted redirect URL. Start by following the Collab eSignet integration guide. If access is not immediate, build against a mock OIDC provider and integrate later.
- **Sandbox limits:** Collab is a shared demo environment; availability, test identities, and allowed features may differ from a production MOSIP deployment.
- **Network:** eSignet sign-in needs connectivity. The first version should have a responsive, low-bandwidth UI, but not promise offline authentication.
- **Privacy:** identity and health information are sensitive. Keep the demo synthetic and avoid adding medical data.
- **Operational fit:** appointment and queue processes vary between clinics. Validate the intended workflow with a clinic representative before claiming real-world impact.
- **Somali translation quality:** Somali is a first-release requirement. Have a fluent Somali reviewer check the language for clarity and local usage before user testing.
- **Growth path:** scaling beyond a personal demo will require a clinic partner, support ownership, security and privacy reviews, operational processes, and agreement with the relevant identity-system owner. The prototype alone does not provide authorization to use a national identity system.

## 11. Success measures for the prototype

- A demo patient can complete sign-in or clearly labeled mock sign-in and reach the appointment screen.
- A patient can book/confirm a sample slot and receive a QR token.
- Staff can scan or manually enter the token and check the appointment in once.
- Expired, invalid, and already-used tokens are rejected with understandable messages.
- The application stores no national ID, biometrics, or health record in the MVP.
- A reviewer can follow the complete demo in under five minutes.

## 12. Delivery phases

1. **Validate access:** open Collab, inspect its eSignet integration guide, and determine whether a relying-party client can be created.
2. **Define language and workflow:** map the Somali and English UI strings, create a glossary, and sketch the patient and receptionist journeys.
3. **Build the PWA:** create welcome, appointments, confirmation/QR, and install experience using React/Vite; add Somali and English.
4. **Build backend and PostgreSQL schema:** implement sample clinics, slots, appointments, one-time tokens, staff queue, and demo reset.
5. **Integrate identity:** connect eSignet OIDC; retain mock mode as a development fallback.
6. **Demo hardening:** add loading/error states, safe PWA caching, synthetic data, and a short walkthrough.
7. **Get feedback:** test the prototype with a few Somali-speaking users and, if available, a clinic receptionist; revise before considering a pilot.

## 13. Longer-term path

1. **Personal prototype:** demonstrate the complete flow with synthetic data and Collab/mock identity.
2. **Workflow validation:** interview patients and clinic staff; confirm language, device, appointment, and queue assumptions.
3. **Small supervised pilot:** only with a clinic partner, approved identity integration, clear data responsibilities, and reviewed privacy/security controls.
4. **Expansion:** assess multi-clinic operations, support, uptime, accessibility, and integrations based on pilot evidence.

Do not present the personal prototype as a live clinic service or connect it to real patient or national-ID data before those prerequisites are met.

## 14. Agreed product decisions

- This is a personal project, with the ambition to grow it if the idea proves useful.
- Somali must be included alongside English in the first patient-facing version.
- The patient experience will be an installable PWA; clinic staff use a responsive web view.
- Frontend and backend will use JavaScript, with PostgreSQL as the database.

## References

- [MOSIP Collab sandbox](https://collab.mosip.net/)
- [eSignet documentation](https://docs.esignet.io/)
- [eSignet GitHub repository and license](https://github.com/mosip/esignet)
- [MOSIP Collab Partner Management guide](https://docs.mosip.io/1.2.0/id-lifecycle-management/support-systems/partner-management-services/functional-overview/collab-pmp-guide)

