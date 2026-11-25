# TennisAI

A multi-platform tennis community app for finding sparring partners, arranging matches and training, booking courts, and managing club activity.

The repository keeps the existing landing page at the root. The application source is in [`tennis-ai/`](tennis-ai/).

## Project components

- **Mobile app** — React Native and TypeScript for Android and iOS.
- **Backend API** — FastAPI, PostgreSQL, Alembic migrations, JWT authentication, and MinIO-compatible object storage.
- **Desktop app** — Electron and React app for tennis club management.
- **Telegram bot** — a separate bot service.

## Functionality

Player profiles and search, matches, training sessions, court reservations and queues, direct chat, competitions, game scores and rankings, activity feed, reports, subscriptions, and push notifications.

## Repository layout

```text
tennis-ai/
├── backend/   FastAPI application, migrations, and seed data
├── mobile/    React Native application and native Android/iOS projects
├── desktop/   Electron club-management app
├── bot/       Telegram bot
└── docker-compose.yml  local PostgreSQL and MinIO services
```

## Local development

Start the local database and object storage:

```bash
cd tennis-ai
docker compose up -d postgres minio
```

Set up the backend:

```bash
cd backend
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

The API docs are available at `http://localhost:8000/docs`.

Install and run the mobile app:

```bash
cd mobile
npm ci
npm start
```

In another terminal, use `npm run android` or `npm run ios`. The API URL defaults to `http://localhost:8000`; update `mobile/src/api/client.ts` when using a physical device or a deployed backend.

The desktop app starts with `npm ci` and `npm run dev` from `tennis-ai/desktop`. Its API URL is configured in `desktop/src/preload/index.ts`.

## Configuration

Copy the example environment files and set your own values. The examples are for local development; use unique secrets and credentials for any deployed environment.

Firebase service-account files and Android/iOS Firebase configuration are not included. Add your own Firebase configuration locally to enable push notifications. Release signing keys are also excluded; Android release signing reads `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD` from the environment.
