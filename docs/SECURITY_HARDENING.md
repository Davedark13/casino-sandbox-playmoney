# Security Hardening

Diese Datei beschreibt, was in der Sandbox bereits gehaertet wurde und was als Nächstes sinnvoll ist.

## Bereits umgesetzt

- Request-IDs pro API-Request mit Rueckgabe im Header `x-request-id`
- strukturierte Request- und Error-Logs im Backend
- `x-powered-by` im Backend deaktiviert
- konfigurierbare CORS-Liste ueber `CORS_ORIGINS`
- JSON-Body-Limit ueber `MAX_JSON_BODY_KB`
- Auth-Rate-Limits fuer Register und Login
- KYC-Upload-Limits fuer Dateigroesse und MIME-Typen
- Security-Header im Staging-Web-Gateway
- Security-Posture-Auswertung in `/admin/overview` und `/admin/security-posture`

## Relevante Dateien

- `backend/src/server.js`
- `backend/src/middleware/requestContext.js`
- `backend/src/middleware/errorHandler.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/kyc.js`
- `backend/src/services/securityService.js`
- `frontend/docker-entrypoint.d/10-render-config.sh`

## Empfohlene naechste Schritte

### 1. Secrets ersetzen

Vor jeder nicht-lokalen Nutzung ersetzen:

- `JWT_SECRET`
- `ADMIN_API_KEY`
- `POSTGRES_PASSWORD`
- `STAGING_BASIC_AUTH_PASSWORD`

### 2. TLS vor den Web-Container

Das Staging-Setup liefert nur einen HTTP-Web-Gateway. Fuer echten externen Zugriff brauchst du:

- TLS-Termination via Reverse Proxy oder Load Balancer
- sichere Zertifikatsverwaltung
- Weiterleitung von HTTP auf HTTPS

### 3. Storage absichern

KYC-Dateien liegen aktuell im Filesystem. Fuer ernsthafte Systeme braucht es:

- Objekt-Storage mit Access Policies
- Verschluesselung at rest
- revisionssichere Aufbewahrung
- Malware-Scanning

### 4. Monitoring ausbauen

Ergaenze:

- Metriken fuer Login-Fehler, Withdraw-Fehler, Rate-Limit-Treffer
- Healthchecks fuer Abhaengigkeiten
- zentrales Alerting statt nur Discord
- Audit-Export in SIEM/Log-Pipeline

### 5. Admin-Zugriff weiter haerten

Derzeit:

- Basic Auth am Web-Gateway
- `x-admin-key` serverseitig ueber Proxy

Fuer spaetere Härtung:

- echtes Admin-Identity-Management
- MFA
- Rollen und Berechtigungen
- Session Revocation

## Nicht im Scope dieser Sandbox

- PCI-DSS-konforme Kartendatenverarbeitung
- Echtgeld-Payout-Härtung
- AML-Case-Management
- Incident- und Forensik-Runbooks fuer Livebetrieb
