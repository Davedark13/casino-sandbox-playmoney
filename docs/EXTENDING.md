# Erweiterungshinweise

## Backend-Einstiegspunkte

- Auth: `backend/src/routes/auth.js`, `backend/src/services/authService.js`
- Admin-API: `backend/src/routes/admin.js`
- Spielrunden: `backend/src/routes/games.js`, `backend/src/services/gameService.js`
- Fraud: `backend/src/services/fraudService.js`
- Stress-Tests: `backend/src/services/simulationService.js`
- Withdrawals: `backend/src/services/withdrawalService.js`

## Typische Erweiterungen

- neue Game-Engines ueber weitere Services statt Logik direkt in Routen
- Outbox-/Queue-Worker fuer Alerts, Reviews oder Payment-Reconciliation
- weitere Fraud-Signale wie Device-Fingerprints, ASN/IP-Reputation oder Velocity pro Payment-Methode
- WebSocket- oder SSE-Feed statt reinem Polling im Dashboard
- eigenes User-Frontend getrennt vom Admin-Frontend

## Datenbank

Die Init-SQL liegt in:

- `backend/migrations/001_init.sql`
- `backend/migrations/002_auth_play_money.sql`

Wenn du neue Tabellen oder Views hinzufuegst:

1. neue SQL-Datei unter `backend/migrations/`
2. bei frischen Docker-Setups laufen diese automatisch mit
3. bei bestehenden Volumes entweder manuell migrieren oder frisches Volume starten

## Edge Cases

- Withdraw-Races: `withdrawalService` fuehrt Idempotency-Checks vor und nach Locks aus
- Replay-Angriffe: Stripe-Event-IDs werden in `payment_events` gespeichert
- Fraud-Scores: ab `RISK_AUTOBLOCK_THRESHOLD` auto-blockt der User
- KYC-Uploads: keine Dokumentinhalte in Logs schreiben, nur Pfade oder Metadaten

## Nicht als fertig betrachten

- echte Live-Payout-Integration
- revisionssichere Dokumentenablage
- SIEM, Metrics, Alert Routing, Backup/Restore
- juristische, regulatorische und AML-relevante Freigaben
