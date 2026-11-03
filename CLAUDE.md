# FinalPing Teams Desktop

Electron + React desktop app for teams (FBOs, charter operators, flight departments). See `../ARCHITECTURE.md` for full system context.

## Stack
- Electron · React (CRA) · Axios · electron-builder
- Protocol: `finalpingteams://`
- Backend: `aircraft-tracker-backend-teams` on Railway

## Key Files
- `build/electron.js` — main process (window, tray, `finalpingteams://` deep link, IPC, auto-updater)
- `build/preload.js` — context bridge with `onOAuthCallback` / `offOAuthCallback`
- `src/App.jsx` — auth state, `LicenseExpiredOverlay`, `ChangelogModal`, Google OAuth handler
- `src/screens/Dashboard.jsx` — main shell with tab nav
- `src/screens/Teams.jsx` — team management tab (members, channels, alerts, airports, shifts, roles)
- `src/screens/ActivationScreen.jsx` — license key + email/password + Google OAuth login
- `src/services/api.js` — Axios client pointing to teams backend
- `src/services/teamBackgroundTracker.js` — background ADS-B polling loop
- `src/services/storage.js` — Electron secure storage

## Commands
```bash
npm install
npm start              # dev
npm run package        # build installer → ../FinalPing-Teams-Builds/
```

## Notes
- After ANY code change: run `npm run package`
- Google OAuth uses `finalpingteams://` scheme (encoded in OAuth state string as `{hex}:finalpingteams`)
- JWT auto-refresh on 401 "Token expired"; license expired overlay on 401 "license_expired"
- Teams tab contains: Members, Channels, Alerts, Airports, Shifts, Roles, Claims, Arrivals, Escalation
