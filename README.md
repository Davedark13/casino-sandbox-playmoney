# Casino Sandbox Admin

Play-Money-Demo fuer ein Casino-/Wallet-/KYC-/Fraud-Monitoring-System mit:

- `Node.js + Express` Backend
- `React + Vite` Admin-Frontend
- `PostgreSQL` fuer Wallets, Transactions, Withdrawals, Flags, KYC und Activity Logs
- `Redis` fuer Rate Limits und Burst-Schutz
- Docker-Setup fuer lokalen Betrieb und geschuetztes Staging

Das Projekt ist absichtlich eine **Sandbox**:

- `APP_MODE=test` ist Standard
- Demo-Spielrunden, Demo-Funding und Stress-Tests laufen nur im Testmodus
- Stripe ist als Integrationspunkt enthalten, Live-Zahlungen bleiben aber gesperrt
- Echtgeldbetrieb ist **nicht** freigegeben und nicht als Produktionsfreigabe gedacht

## Was Enthalten Ist

- User-Auth mit `bcryptjs` + `JWT`
- Wallets, Deposits, Demo-Bets, Wins und Withdraw-Workflows
- Withdraw-Idempotency, Cooldown und Daily Limits
- KYC-Upload und Admin-Review
- AI-Fraud-Signale, Auto-Block ab Risikoschwelle und Discord-Alerts
- Admin-API fuer Users, Withdrawals, Transactions, Fraud, Logs und KYC
- Stress-Simulation fuer `concurrent_bets`, `withdraw_race` und `bot_attack`
- Security-Posture-Pruefung, Request-IDs, Auth-Rate-Limits und Upload-Grenzen
- Docker- und Staging-Setup

## Schnellstart

```bash
cd /home/mediaserver/casino-sandbox
cp .env.example .env
docker compose up --build
docker compose exec backend npm run seed
```

Danach:

- Admin UI: `http://localhost:5173`
- Backend API: `http://localhost:8080`
- Health: `http://localhost:8080/health`

Wenn du schon eine alte DB-Volume aus einer frueheren Version hast, initialisiere frisch:

```bash
docker compose down -v
docker compose up --build
```

## Demo-Zugaenge

Admin:

- lokales Frontend nutzt den Vite-Proxy und injiziert `ADMIN_API_KEY` automatisch
- direkter Admin-API-Zugriff per Header: `x-admin-key: change-me-admin-key`

Demo-User:

- `alice`, `bob`, `carol`
- `sim1` bis `sim12` nach `npm run seed`
- Passwort fuer die Sandbox-User: `sandbox-demo-123`

## Wichtige Endpunkte

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /wallet/demo-fund`
- `POST /games/demo-round`
- `POST /withdrawals`
- `GET /admin/overview`
- `GET /admin/users`
- `GET /admin/withdrawals`
- `GET /admin/transactions`
- `GET /admin/fraud`
- `GET /admin/logs`
- `GET /admin/kyc`
- `POST /admin/simulate/stress`

## Doku

- Vollstaendiger Ablauf: `docs/STEP_BY_STEP.md`
- Staging-Deploy: `docs/DEPLOYMENT.md`
- GitHub-Publish: `docs/GITHUB_SETUP.md`
- Erweiterungspunkte: `docs/EXTENDING.md`
- Security-Hardening: `docs/SECURITY_HARDENING.md`
- Compliance-Gap-Analyse: `docs/COMPLIANCE_GAP_ANALYSIS.md`
- Handover-Architektur: `docs/ARCHITECTURE_HANDOFF.md`

## Sicherheitsgrenzen

Dieses Repository ist fuer Play-Money-Tests, Admin-Ops und Architekturarbeit gedacht. Live-Money-Flags (`APP_MODE=live`, `LIVE_MONEY_ENABLED=true`, `LEGAL_APPROVED=true`) bleiben nur als Guardrail im Code erhalten und sind **keine** Produktionsfreigabe.
