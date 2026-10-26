# DaryeelPass

A Somali and English clinic appointment and check-in PWA prototype with a JavaScript API backend. This remains a synthetic-data learning project; it is not for real clinic visits or real patient information.

## Run locally

```sh
npm install
npm run dev
```

Use the language switch in the top bar. Book a sample visit to see the appointment flow, or open the next visit's QR pass. On supported browsers, the app can be installed from the browser's install prompt.

## Current scope

- React and Vite frontend in JavaScript.
- Somali and English patient interface.
- Installable PWA shell with static asset caching.
- Sample appointment booking and QR pass preview held in frontend state.
- eSignet login dialog is a preview only; real OIDC setup is a later backend step.
- No patient data is sent to a server.

## Production build

```sh
npm run build
npm run preview
```

## Backend

The Express API and PostgreSQL setup live in [`backend/`](backend/README.md). Follow that README to start PostgreSQL, migrate and seed the database, then run the API. The current frontend is still using local sample state; wiring it to the API is the next step. eSignet authentication is not connected yet.
