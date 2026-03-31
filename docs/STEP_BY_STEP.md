# Step By Step Guide

Diese Anleitung fuehrt dich von einem frischen Checkout bis zur lauffaehigen Play-Money-Sandbox.

## 1. Voraussetzungen

Du brauchst:

- Docker Engine mit `docker compose`
- Node.js und npm nur dann, wenn du Backend oder Frontend lokal ausserhalb von Docker starten willst
- einen freien Host-Port fuer `5173`, `8080`, `5432` und `6379`

## 2. Projekt vorbereiten

```bash
cd /home/mediaserver/casino-sandbox-playmoney
cp .env.example .env
```

Wichtige Default-Werte:

- `APP_MODE=test`
- `LIVE_MONEY_ENABLED=false`
- `LEGAL_APPROVED=false`
- `ADMIN_API_KEY=change-me-admin-key`
- `CORS_ORIGINS=http://localhost:5173,...`
- `MAX_JSON_BODY_KB=200`
- `KYC_MAX_FILE_SIZE_MB=8`

## 3. Stack starten

```bash
docker compose up --build
```

Das startet:

- `postgres`
- `redis`
- `backend`
- `frontend`

## 4. Datenbank frisch initialisieren

Wenn du den Stack schon frueher mit alten Volumes gestartet hast und neue Migrationen dazugekommen sind:

```bash
docker compose down -v
docker compose up --build
```

So werden `001_init.sql` und `002_auth_play_money.sql` sauber erneut ausgefuehrt.

## 5. Demo-User erzeugen

```bash
docker compose exec backend npm run seed
```

Danach hast du:

- Basis-User `alice`, `bob`, `carol`
- zusaetzliche `sim1` bis `sim12`
- Passwort fuer alle Sandbox-User: `sandbox-demo-123`

## 6. Admin-Panel oeffnen

Im Browser:

```text
http://localhost:5173
```

Das lokale Frontend spricht ueber den Vite-Proxy mit dem Backend und reicht den Admin-Key automatisch weiter.

## 7. Admin-Features testen

Im Dashboard kannst du direkt:

- User blocken oder entblocken
- Risk neu berechnen
- Withdrawals approven oder rejecten
- KYC-Eintraege verifizieren oder ablehnen
- Stress-Tests fuer `Concurrent Bets`, `Withdraw Race` und `Bot Attack` starten

## 8. User-API per CLI testen

Login:

```bash
curl -X POST http://localhost:8080/auth/login \
  -H 'content-type: application/json' \
  -d '{"usernameOrEmail":"alice","password":"sandbox-demo-123"}'
```

Token aus der Antwort in `TOKEN` setzen und Demo-Runde spielen:

```bash
curl -X POST http://localhost:8080/games/demo-round \
  -H "authorization: Bearer TOKEN" \
  -H "idempotency-key: demo-round-1" \
  -H 'content-type: application/json' \
  -d '{"amountCents":500,"metadata":{"source":"manual-check"}}'
```

Demo-Funding:

```bash
curl -X POST http://localhost:8080/wallet/demo-fund \
  -H "authorization: Bearer TOKEN" \
  -H "idempotency-key: demo-fund-1" \
  -H 'content-type: application/json' \
  -d '{"amountCents":2500}'
```

Withdraw anfragen:

```bash
curl -X POST http://localhost:8080/withdrawals \
  -H "authorization: Bearer TOKEN" \
  -H "idempotency-key: withdraw-1" \
  -H 'content-type: application/json' \
  -d '{"amountCents":1000,"destinationMetadata":{"iban":"DEMO-ONLY"}}'
```

## 9. Admin-API per CLI testen

```bash
curl http://localhost:8080/admin/overview \
  -H 'x-admin-key: change-me-admin-key'
```

Stress-Simulation:

```bash
curl -X POST http://localhost:8080/admin/simulate/stress \
  -H 'x-admin-key: change-me-admin-key' \
  -H 'content-type: application/json' \
  -d '{"scenario":"withdraw_race","iterations":6}'
```

Weitere Szenarien:

- `concurrent_bets`
- `withdraw_race`
- `bot_attack`

## 10. Protected Staging deployen

Beispiel:

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Die Weboberflaeche laeuft dann ueber den Web-Container mit Basic Auth.

Mehr Details: `docs/DEPLOYMENT.md`

Security-Checkliste: `docs/SECURITY_HARDENING.md`

## 11. Nach GitHub pushen

Wenn du den Code nach GitHub pushen willst:

```bash
git status
git add .
git commit -m "Expand play-money casino sandbox admin system"
git push -u origin main
```

Wenn `origin` noch fehlt oder du ein neues Repo verwenden willst, nutze `docs/GITHUB_SETUP.md`.

## 12. Was fuer Echtgeld noch fehlt

Nicht als erledigt betrachten:

- Lizenz- und Rechtspruefung
- echte Zahlungsabwicklung fuer Auszahlungen
- revisionssichere KYC-Storage-Loesung
- Secret Management, TLS, HSM/KMS
- SIEM, Metrics, Incident Playbooks, Backup/Restore

Diese Sandbox ist fuer Demo-, Test- und Architekturzwecke gebaut, nicht fuer oeffentlichen Echtgeldbetrieb.
