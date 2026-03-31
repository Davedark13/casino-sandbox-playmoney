# Compliance Gap Analysis

Diese Analyse ist **keine Rechtsberatung** und **keine Freigabe** fuer Echtgeldbetrieb. Sie dient als technische und organisatorische Lueckenliste fuer ein spaeteres lizenziertes Team.

## Zielbild

Ein lizenzierter Betreiber fuer regulierte Echtgeld-Transaktionen braucht typischerweise:

- klare Jurisdiktionsabdeckung
- formalen Lizenzrahmen
- AML/KYC-Betriebsprozesse
- revisionssichere Ledger- und Audit-Pfade
- Incident-Management, Monitoring und Reporting
- Datenschutz- und Aufbewahrungskonzepte

## Aktueller Stand der Sandbox

Vorhanden:

- User-Auth
- Wallet- und Ledger-Bausteine
- KYC-Upload und Review-Workflow
- Fraud-Signale und Auto-Block
- Admin-Oberflaeche fuer Monitoring und Eingriffe
- idempotente Withdrawal-Anfragen mit Locking

Nicht vorhanden oder bewusst nicht freigegeben:

- rechtskonforme Echtgeld-Zahlungsabwicklung
- echte Auszahlungspartner und Settlement-Prozesse
- regulatorische Berichtsprozesse
- vollstaendige AML-Case-Management-Funktionen
- revisionssichere Dokumenten- und Beweisablage
- formale Rollen- und Vier-Augen-Freigaben

## Gap-Kategorien

### 1. Lizenz und Jurisdiktion

Gap:

- keine Lizenzmodellierung
- keine jurisdiktionsspezifischen Freigaben
- keine Geo-/Eligibility-Controls

Noetig:

- Rechtsanalyse pro Zielmarkt
- Zulassungs- und Verbotsmatrix
- Geo-Blocking und Nutzer-Eignungsregeln

### 2. Payments und Echtgeld-Settlement

Gap:

- Stripe nur als Integrationspunkt
- keine echte Auszahlungskette
- kein Reconciliation-Workflow
- kein Chargeback-/Dispute-Handling

Noetig:

- regulierte Payment-/Payout-Partner
- Clearing, Settlement und Reconciliation
- Chargeback-Playbooks
- gesondertes Treasury-/Cash-Management

### 3. AML/KYC Operations

Gap:

- KYC ist technisch nur ein einfacher Sandbox-Workflow
- keine Watchlist-, PEP- oder Sanctions-Pruefungen
- keine Case-Queues oder SAR/STR-Prozesse

Noetig:

- echte Provider-Integration
- laufende Re-Screenings
- manuelle Review-Queues
- dokumentierte AML-Eskalationen

### 4. Audit und Aufbewahrung

Gap:

- Audit-Logs sind app-intern
- keine unveraenderbare Langzeitablage
- keine Nachweis- und Exportpfade fuer regulatorische Anfragen

Noetig:

- Write-once/immutable Logging
- Aufbewahrungsrichtlinien
- beweissichere Exporte

### 5. Zugriffskontrollen

Gap:

- Admin-Zugriff ist staging-tauglich, aber nicht governance-tauglich
- keine MFA
- keine getrennten Rollen fuer Fraud, Support, Finance, Compliance

Noetig:

- RBAC/ABAC
- MFA und Session Governance
- SoD-Trennung fuer Freigaben

### 6. Responsible Gaming

Gap:

- keine Selbstlimitierung
- keine Self-Exclusion
- keine Verhaltenswarnungen oder Cooling-Off-Funktionen

Noetig:

- Responsible-Gaming-Mechanismen
- dokumentierte Schutzprozesse
- Limits, Sperren und Hinweise

## Empfohlene Reihenfolge fuer ein lizenziertes Team

1. Jurisdiktion und Lizenzrahmen festlegen.
2. Payment-, AML- und Responsible-Gaming-Anforderungen verbindlich definieren.
3. Architektur in getrennte Domains fuer Identity, Ledger, Payments, Compliance, Risk und Admin aufteilen.
4. Immutable Audit, KMS/Secrets, Monitoring und Incident-Prozesse vor Livebetrieb fertigstellen.
5. Externe Security-, Compliance- und Penetration-Tests durchfuehren.

## Klare Grenze

Diese Repository-Version ist fuer Demo-, Test- und Architekturarbeit. Sie ist nicht die letzte Meile zu einer Echtgeld-Produktionsfreigabe.
