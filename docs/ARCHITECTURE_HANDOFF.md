# Architecture Handoff

Diese Datei beschreibt, wie ein lizenziertes Team die Sandbox in klar getrennte Verantwortungsbereiche uebernehmen koennte, ohne diese Codebasis direkt als Echtgeld-Produktionssystem zu betrachten.

## Ziel

Die Sandbox soll als Referenz dienen fuer:

- Datenmodell
- Admin-Prozesse
- Fraud-/Risk-Denke
- Monitoring- und Test-Szenarien

Nicht als direkte Live-Basis.

## Empfohlene Zielarchitektur

### 1. Identity Service

Verantwortung:

- User-Registrierung
- Login
- MFA
- Rollen und Sessions
- Geräte- und Session-Management

### 2. Wallet/Ledger Service

Verantwortung:

- Kontostaende
- unveraenderliches Ledger
- Bilanzierung
- Sperrbuchungen
- Reconciliation mit externen Zahlungsereignissen

### 3. Payments Service

Verantwortung:

- Deposits
- Withdrawals
- Provider-Abstraktion
- Webhooks
- Reconciliation
- Dispute/Chargeback-Faelle

### 4. Compliance Service

Verantwortung:

- KYC/KYB
- AML-Faelle
- Dokumentenmanagement
- Screening und Review-Queues
- Reporting-Exports

### 5. Risk/Fraud Service

Verantwortung:

- Risk Scoring
- Velocity Checks
- Device/IP-Signale
- Auto-Holds
- Falluebergabe an Compliance/Operations

### 6. Gaming Engine Domain

Verantwortung:

- RNG bzw. zertifizierte Spiel-Engines
- Spielrunden
- Bet-/Win-Abrechnung
- zertifizierbare Nachweise und Versionierung

### 7. Admin/Operations Frontend

Verantwortung:

- Fallmanagement
- User-Review
- Withdraw-Freigaben
- Risiko- und Systemmonitoring
- getrennte Rollenflaechen

## Was aus der Sandbox uebernommen werden kann

- Datenmodell-Ideen aus `users`, `transactions`, `withdrawals`, `user_flags`, `kyc_documents`, `audit_logs`
- idempotente Withdrawal-Patterns
- Stress-Simulationen fuer Race-Tests
- Fraud-Signal-Ansatz
- Admin-Panel-Informationsarchitektur

## Was neu gebaut werden sollte

- echte Ledger-Grenzen und unveraenderliche Buchungsschicht
- Payment-Reconciliation und Settlement
- Admin-Identity mit MFA und RBAC
- revisionssichere KYC-/Evidence-Storage-Loesung
- Queue-/Worker-System fuer Webhooks, Reviews und Alerts
- externes Observability- und Incident-Setup

## Handover-Modell

Sinnvolle Teams:

- Platform/SRE
- Identity/Security
- Payments/Treasury
- Compliance/AML
- Risk/Fraud
- Admin/Operations UI

Jedes Team sollte:

- ein klares Service-Boundary besitzen
- eine eigene Daten- und Deployment-Verantwortung tragen
- definierte Schnittstellen und Ereignisse uebernehmen

## Empfohlene ersten Artefakte fuer die Uebergabe

- Domain-Event-Katalog
- Datenklassifizierungs-Matrix
- Trust-Boundary-Diagramm
- Zugriffsmatrix fuer Admin-Rollen
- Failure-Mode- und Reconciliation-Runbooks

## Praktische Nutzung dieser Sandbox

Kurzfristig sinnvoll:

- Admin-Flows demonstrieren
- Risk-/Stress-Szenarien ueben
- Datenmodell testen
- UI-Struktur abstimmen

Nicht sinnvoll:

- Echtgeld-Freigabe ableiten
- regulatorische Freigabe annehmen
- Live-Betrieb ohne kompletten Neuaufbau kritischer Domänen
