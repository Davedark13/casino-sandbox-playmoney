# GitHub Setup Guide

Diese Repo-Struktur ist bereit fuer einen normalen GitHub-Push. Falls `origin` schon gesetzt ist, pruefe zuerst die aktuelle Remote:

```bash
cd /home/mediaserver/casino-sandbox
git remote -v
```

## 1. Git Identity pruefen

```bash
git config --global user.name
git config --global user.email
```

Falls leer:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

## 2. Optional: Neues GitHub-Repo anlegen

In GitHub:

1. `New repository`
2. Repo-Namen waehlen
3. am besten privat starten
4. kein README oder `.gitignore` vorab anlegen, wenn du den bestehenden Ordner pushst

Beispiel:

```text
https://github.com/YOUR-USER/casino-sandbox.git
```

## 3. Remote setzen oder aendern

Neues Remote:

```bash
git remote add origin https://github.com/YOUR-USER/casino-sandbox.git
```

Oder vorhandenes Remote aendern:

```bash
git remote set-url origin https://github.com/YOUR-USER/casino-sandbox.git
```

## 4. Commit erstellen

```bash
git status
git add .
git commit -m "Expand play-money casino sandbox admin system"
```

## 5. Push

```bash
git push -u origin main
```

Wenn GitHub ueber HTTPS nach Auth fragt, nutze:

- einen Personal Access Token statt Passwort
- oder richte SSH-Keys ein und wechsle auf `git@github.com:YOUR-USER/casino-sandbox.git`

## 6. Nach dem Push

Empfohlen:

- Repo auf `private` lassen, wenn es nur intern oder fuer Staging ist
- `main` schützen
- keine echten Secrets committen
- `.env` und `.env.production` lokal halten

## 7. Wichtige Dateien fuer GitHub

- `README.md`
- `docs/STEP_BY_STEP.md`
- `docs/DEPLOYMENT.md`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `.env.example`
- `.env.production.example`
