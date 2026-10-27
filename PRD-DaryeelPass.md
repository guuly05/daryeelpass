# PRD: DaryeelPass Hargeisa Clinic Directory

**Status:** Local directory MVP, October 2026

**Product type:** Somali- and English-language progressive web app
**Initial market:** Hargeisa, Somaliland

## Product summary

DaryeelPass helps people in Hargeisa find clinic contact details, departments, and clinicians that facilities publish on their own websites. People can search the directory, call or email a clinic, and open the clinic's own appointment page. The app links to the sources and shows when its directory record was last checked.

The current directory is not a partnership or endorsement list. DaryeelPass does not have live clinic schedules, confirm appointments, transmit patient requests, or receive clinic booking confirmations. Users must confirm details directly with each facility.

## Current users and goals

- **Community member:** find a clinic, service, public phone number, address, or official appointment page in Somali or English.
- **Directory maintainer:** add and update clinic information from public sources, with provenance and a review date.

The current goals are to provide a useful, searchable Hargeisa directory; make phone, email, and official links easy to use on mobile; and avoid presenting unconfirmed schedule information as available.

## Current scope

- Somali and English interface.
- Clinic search by name, service, or clinician name.
- Public clinic contact details, service lists, and clinic-published clinician profiles.
- Click-to-call, email, official website, and appointment-page links.
- Source links and a checked date for each listing.
- Public browsing without an account or patient data collection.

## Out of scope until clinics participate

- Live appointment availability or confirmed DaryeelPass bookings.
- Patient medical records, diagnoses, prescriptions, or test results.
- Patient check-in, queue management, or QR passes for clinic visits.
- Production eSignet identity use or claims that clinics are DaryeelPass partners.
- Recommendations about what care a person should seek.

## Directory data rules

1. Record a facility only with a public source for its name and Hargeisa presence.
2. List clinician names and specialties only when the facility's own public page names them. Label them as clinic-listed and link to that page; do not independently claim registration, current availability, or credentials.
3. Include phone, email, address, department, and appointment links only when published by that facility.
4. Store a source URL and checked date with each directory record. Review public details regularly and correct or remove stale entries.
5. Do not collect health information in search, contact, or booking forms. Outbound links and calls go directly to the facility.

## Current interaction flow

1. Select Somali or English.
2. Search or browse clinics and departments.
3. Review the listed doctors, public contact details, source, and checked date.
4. Call, email, or continue to the facility's own appointment page.
5. Confirm availability and all visit details with that facility.

## Technical shape

- **Frontend:** React and Vite, installable PWA shell.
- **Backend:** Node.js, Express, PostgreSQL, Prisma.
- **Directory:** PostgreSQL records populated by the reviewed seed file; public API returns only active clinic records.
- **Authentication:** eSignet integration code exists for local development, but the token exchange is not yet confirmed working. Sign-in is not required to use the directory and must not be represented as production identity verification.

Legacy appointment and check-in API models are development-only and do not power the current clinic directory. They must not be presented as live clinic functionality.

## Success criteria for the directory MVP

- A user can search clinic names, departments, and clinic-listed clinician names.
- Each displayed entry includes its source and last-checked date.
- Phone, email, official website, and supported appointment links open correctly.
- No synthetic appointment, doctor, or clinic is presented as a real listing.
- The app does not claim that a listed facility partners with DaryeelPass.
- The directory works on a phone and remains usable in both languages.

## Next phases

1. Ask each facility to review its public listing and authorize any DaryeelPass representation.
2. Agree with a clinic on appointment workflow, operational ownership, data responsibilities, and schedule integration.
3. Implement booking requests only against a clinic-approved workflow; show pending requests until the facility confirms them.
4. Complete privacy, security, reliability, support, and legal reviews before handling real patient identity or appointment data.
5. Revisit eSignet with production relying-party credentials and verify the complete login flow before presenting it as available.

Do not use the local development environment to enter real patient, national identity, or medical data.
