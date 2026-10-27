# DaryeelPass

DaryeelPass is a Somali- and English-language clinic directory for Hargeisa. It presents public contact details, services, and clinician names published by the clinics themselves, with links back to those sources.

## What works now

- Search clinics by name, service, or publicly listed clinician.
- Open clinic websites and appointment pages, call, or email the clinic.
- View the source and date checked for each listing.
- Browse in Somali or English on desktop and mobile.

The listed clinics have not been onboarded as DaryeelPass partners. DaryeelPass does not see live appointment availability, confirm bookings, or send a request to clinic systems. Use each clinic's own contact and booking channels to confirm details. Do not use this app for urgent care; contact emergency services or a clinic directly.

## Run locally

1. Start PostgreSQL using the instructions in [`backend/README.md`](backend/README.md).
2. Install frontend dependencies: `npm install`.
3. In `backend/`, copy `.env.example` to `.env`, set a unique `SESSION_SECRET`, and start the API with `npm install`, `npm.cmd run db:generate`, `npm.cmd run db:deploy`, `npm.cmd run db:seed`, and `npm.cmd run dev`.
4. In the repository root, run `npm run dev` and open the Vite URL, normally `http://localhost:5173`.

The public clinic directory is read from PostgreSQL through the backend API. The seed includes published clinic details and sample appointment records used only for local development; clinic listings do not imply partnership or appointment availability.

## Data sourcing and maintenance

Clinic names, contact details, service lists, and clinician affiliations in the seed are transcribed from the listed facilities' official sites. Each directory record links to its public source and includes a checked date. Public web listings can become outdated; confirm details directly with the clinic and update the seed when sources change. This project does not independently verify professional registration or clinician availability.

## Deployment boundary

This code is a working local directory, not an operational clinical service. Live booking requires each clinic's agreement and schedule integration. Patient accounts, real patient information, staff check-in, and production eSignet use require clinic onboarding, authorization, data-protection review, production identity credentials, and security and operational controls. Do not enter real patient or identity data into the local development setup.

## Stack

- React and Vite frontend with Somali/English copy and a PWA shell.
- Express API and PostgreSQL database using Prisma.
- Optional eSignet login integration for the local MOSIP sandbox.
