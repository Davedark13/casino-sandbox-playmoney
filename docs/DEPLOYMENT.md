# Deployment Guide

Diese Anleitung beschreibt einen **geschuetzten Staging-Deploy** fuer die Play-Money-Sandbox.

Sie ist gedacht fuer:

- internes Testen
- Demo-Umgebungen
- Admin-Zugriff hinter Basic Auth

Sie ist **kein** Echtgeld-Produktionsleitfaden.

## Dateien

- `docker-compose.prod.yml`
- `.env.production.example`
- `frontend/Dockerfile.prod`
- `frontend/docker-entrypoint.d/10-render-config.sh`

## 1. Environment vorbereiten

```bash
cd /home/mediaserver/casino-sandbox-playmoney
cp .env.production.example .env.production
```

Setze mindestens:

- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ADMIN_API_KEY`
- `CORS_ORIGINS`
- `APP_BASE_URL`
- `WEB_PORT`
- `STAGING_BASIC_AUTH_USER`
- `STAGING_BASIC_AUTH_PASSWORD`

Empfohlen:

- `APP_MODE=test`
- `LIVE_MONEY_ENABLED=false`
- `LEGAL_APPROVED=false`
- `TRUST_PROXY=true`

## 2. Stack starten

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Das startet:

- PostgreSQL
- Redis
- Backend
- Web-Gateway mit Basic Auth

## 3. Demo-Daten seeden

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run seed
```

## 4. Deployment pruefen

Im Browser:

```text
http://SERVER_OR_DOMAIN:WEB_PORT
```

CLI:

```bash
curl http://localhost:8088/health
curl -u admin:YOUR_PASSWORD http://localhost:8088/api/admin/overview
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

## 5. Update ausrollen

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## 6. Zuruecksetzen

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down -v
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## 7. Sicherheitsnotizen

- UI-Zugriff laeuft ueber Basic Auth und den Web-Gateway
- Admin-Key bleibt serverseitig und wird per Proxy injiziert
- fuer echtes Internet-Exposure fehlen immer noch TLS-Termination, Monitoring, Secret Rotation, Backup/Restore und Incident-Prozesse
- Echtgeldbetrieb bleibt deaktiviert
