# LectureScript – Production Deployment & Operations Guide

This guide documents the end-to-end production deployment, configuration, security, database migration, and maintenance procedures for **LectureScript**.

---

## 1. System Architecture

```
[ Client Browser ]
        │
        ▼ (HTTPS)
┌─────────────────────────────────┐
│ Cloudflare Pages (Frontend)     │
│ React 19 + Vite 8 SPA           │
│ URL: https://<project>.pages.dev│
└────────────────┬────────────────┘
                 │ (REST API + CORS with Credentials)
                 ▼ (HTTPS)
┌─────────────────────────────────┐
│ Render Web Service (Backend)    │
│ Node.js Express Server          │
│ Region: Singapore (ap-southeast)│
│ URL: https://<api>.onrender.com │
└───────┬─────────────────┬───────┘
        │                 │
        │ SQL (Pool)      │ HTTPS (TLS 1.3)
        ▼                 ▼
┌──────────────────┐ ┌──────────────────┐
│ Neon PostgreSQL  │ │ Google Gemini AI │
│ Region: Singapore│ │ @google/genai    │
└──────────────────┘ └──────────────────┘
```

---

## 2. Prerequisites & Accounts

1. **GitHub Account**: Target repository: `https://github.com/keluchnayak/Lecture_Script.git`
2. **Render Account**: [render.com](https://render.com) (Free tier web service)
3. **Cloudflare Account**: [dash.cloudflare.com](https://dash.cloudflare.com) (Cloudflare Pages)
4. **Neon PostgreSQL Account**: [neon.tech](https://neon.tech) (Existing project in Singapore `ap-southeast-1`)
5. **Google AI Studio API Key**: [aistudio.google.com](https://aistudio.google.com)

---

## 3. Phase 1: Push Code to GitHub

Ensure your local repository is committed and pushed to GitHub:

```bash
# 1. Initialize git (if not already done)
git init
git branch -M main

# 2. Add remote repository
git remote add origin https://github.com/keluchnayak/Lecture_Script.git

# 3. Verify .env is NOT staged
git status

# 4. Stage, commit, and push
git add .
git commit -m "feat: configure production deployment for Render and Cloudflare Pages"
git push -u origin main
```

> [!CAUTION]
> Never commit `.env` or `.env.local`. Ensure only `.env.example` is tracked by git.

---

## 4. Phase 2: Deploy Backend to Render

### Option A: Using the Render Blueprint (`render.yaml` — Recommended)
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Select your repository: `keluchnayak/Lecture_Script`.
4. Render will parse `render.yaml` automatically.
5. In the environment variables prompt:
   - Provide `DATABASE_URL` (your Neon pooled connection string).
   - Provide `GEMINI_API_KEY` (your Google Gemini API key).
   - Provide `ALLOWED_ORIGINS` (leave placeholder or set to your Cloudflare Pages domain).
6. Click **Apply**.

### Option B: Manual Web Service Setup
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Connect your GitHub repository: `keluchnayak/Lecture_Script`.
3. Fill in the service configuration:
   - **Name**: `lecturescript-api`
   - **Region**: `Singapore (Southeast Asia)` *(matches your Neon database for minimal latency)*
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build:server`
   - **Start Command**: `npm run start`
   - **Plan**: `Free`
4. Under **Advanced** -> **Health Check Path**, enter: `/health`
5. Under **Environment Variables**, add:
   | Key | Value / Source | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production optimizers & cross-origin cookies |
   | `PORT` | `10000` | Port assigned by Render |
   | `GEMINI_API_KEY` | `AIzaSy...` | Google Gemini API key |
   | `DATABASE_URL` | `postgresql://...-pooler...` | Neon Pooled connection string |
   | `DIRECT_URL` | `postgresql://...` | Neon Direct connection string (optional) |
   | `SESSION_SECRET` | `(32+ random hex string)` | Used for session cookie hashing |
   | `ALLOWED_ORIGINS` | `https://<your-cf-pages>.pages.dev` | Frontend origin for CORS |
6. Click **Create Web Service**.
7. Once deployed, note your Render URL: `https://lecturescript-api.onrender.com`.

### ⚠️ Render Free Tier Cold-Start Limitations
- Render Free web services automatically spin down after **15 minutes of inactivity**.
- The first request after a sleep period incurs a **50–90 second cold start** while the container initializes.
- **Mitigation options**:
  1. Use an external uptime monitor (e.g. [UptimeRobot](https://uptimerobot.com) or [Cron-Job.org](https://cron-job.org)) to ping `https://lecturescript-api.onrender.com/health` every 10 minutes to prevent sleep.
  2. Upgrade to Render Starter ($7/month) when transitioning from testing to continuous production.

---

## 5. Phase 3: Deploy Frontend to Cloudflare Pages

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com).
2. In the sidebar, navigate to **Compute (Workers & Pages)** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Select your GitHub repository: `keluchnayak/Lecture_Script`.
4. Configure the build settings:
   - **Project Name**: `lecturescript` (or your preferred name)
   - **Production Branch**: `main`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `dist`
5. Under **Environment Variables (Advanced)**:
   | Variable Name | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://lecturescript-api.onrender.com` (Your Render backend URL) |
6. Click **Save and Deploy**.
7. Cloudflare Pages will run `npm run build`, bundle the app, deploy assets to its global Edge network, and provide your URL: `https://lecturescript.pages.dev`.

### Update Backend CORS Allowlist
Now that you have your Cloudflare Pages URL:
1. Return to **Render Dashboard** -> `lecturescript-api` -> **Environment Variables**.
2. Update `ALLOWED_ORIGINS` to include your exact Cloudflare Pages URL:
   ```
   ALLOWED_ORIGINS=https://lecturescript.pages.dev,http://localhost:5173,http://localhost:3000
   ```
3. Save changes (Render will automatically redeploy with the updated allowlist).

---

## 6. Phase 4: Neon PostgreSQL Management & Migrations

### Connection Strings
- **Runtime Pooler (Backend)**: Always use the pooled connection string in `DATABASE_URL`:
  `postgresql://neondb_owner:***@ep-holy-base-az46e6mm-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
- **Direct Unpooled (Migrations)**: Use the direct connection string in `DIRECT_URL`:
  `postgresql://neondb_owner:***@ep-holy-base-az46e6mm.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

### Running Migrations Safely
The application includes a migration runner in `db/migrate.ts` that tracks applied migrations inside the `schema_migrations` table:

```bash
# Run migrations against Neon
npm run migrate
```

### Adding New Migrations
1. Create a sequentially numbered file in `db/migrations/`, e.g. `002_add_feature.sql`.
2. Wrap DDL statements safely:
   ```sql
   -- Use IF NOT EXISTS for tables and columns
   ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);
   ```
3. Run `npm run migrate`. The migration runner executes in an atomic transaction (`BEGIN` ... `COMMIT`) and registers the version in `schema_migrations`.

### Rollback Procedure
If a migration fails or needs to be reverted:
1. Since each migration runs inside a transaction, failed migrations are automatically rolled back (`ROLLBACK`) without leaving corrupt partial states.
2. To revert an applied migration, create a compensating migration (e.g. `003_revert_feature.sql`) rather than editing previously applied SQL files.

---

## 7. Security & Compliance Checklist

- [x] **Cross-Origin Session Cookies**: In production, cookies are set with `HttpOnly: true`, `Secure: true`, and `SameSite: 'none'`.
- [x] **Reverse Proxy Trust**: `app.set('trust proxy', 1)` enables correct protocol detection behind Render and Cloudflare SSL proxies.
- [x] **Strict CORS**: CORS headers strictly allow approved origins with credentials enabled; wildcards are not used for credentialed endpoints.
- [x] **Rate Limiting**:
  - Authentication: 10 attempts per 15 minutes per IP.
  - Gemini AI Generation: 15 calls per 5 minutes per IP.
- [x] **Multi-Tenant Isolation**: All user notes, flashcards, and progress queries strictly scope by `WHERE user_id = $1` using verified session tokens. Browser-supplied user IDs are never trusted.
- [x] **Password Protection**: Hashed using `bcryptjs` with 12 salt rounds.
- [x] **Token Hashing**: Plaintext session tokens and password reset tokens are hashed with SHA-256 before database storage.
- [x] **Client-Side File Processing**: Uploaded documents are read into browser memory; no user files are stored on ephemeral server disks.
- [x] **Gemini Master API Key**: Kept exclusively on the backend in environment variables; never leaked to frontend JavaScript bundles.

---

## 8. Post-Deployment Verification Matrix

Run through this test suite on your live production URL (`https://<project>.pages.dev`):

| Test # | Test Scenario | Acceptance Criteria | Verified |
|---|---|---|:---:|
| 1 | **Homepage Load** | Page loads instantly with clean CSS, Google Fonts, and zero console errors. | [ ] |
| 2 | **Frontend Routing** | Navigating between Home, Study Studio, Flashcards, Practice, Library, and Settings preserves state. | [ ] |
| 3 | **Account Registration** | New user signs up, password hashes correctly, and session cookie is stored in browser. | [ ] |
| 4 | **Session Persistence** | Refreshing the page keeps the user logged in (`/api/auth/me` returns 200). | [ ] |
| 5 | **Sign Out** | Logging out destroys session in Neon and clears the session cookie. | [ ] |
| 6 | **Guest Mode** | Creating notes or flashcards without an account works in local storage only (never synced to DB). | [ ] |
| 7 | **Gemini Note Generation** | Pasting a transcript generates comprehensive Cornell study notes via backend Gemini API. | [ ] |
| 8 | **Flashcard Generation** | Creating a deck with AI returns structured questions, answers, and tags. | [ ] |
| 9 | **Cloud Sync** | Notes and flashcards automatically sync to Neon PostgreSQL (`syncState: 'synced'`). | [ ] |
| 10 | **Library Persistence** | Navigating to Library displays all user-saved lectures across devices. | [ ] |
| 11 | **Data Ownership** | Logging in as User B cannot access, read, or delete User A's lectures. | [ ] |
| 12 | **PDF Export** | Exporting study notes to PDF renders clean layout without clipping. | [ ] |
| 13 | **Lofi Audio Mixer** | Audio continues playing uninterrupted while navigating between SPA views. | [ ] |
| 14 | **Mobile Layout** | Responsive design adapts properly on mobile viewport dimensions. | [ ] |
| 15 | **Healthcheck Verification** | `https://<api>.onrender.com/health` returns `{ "status": "ok" }`. | [ ] |
| 16 | **Bundle Secret Audit** | Inspecting network tabs and JS bundles confirms zero database URLs or master API keys are exposed. | [ ] |

---

## 9. Maintenance & Troubleshooting

### Issue: API returns 401 Unauthorized after login
- **Cause**: Browser blocked third-party session cookie or `ALLOWED_ORIGINS` is missing.
- **Solution**:
  1. Verify Render environment has `NODE_ENV=production`.
  2. Verify `ALLOWED_ORIGINS` matches the exact Cloudflare Pages domain (including `https://`).
  3. Ensure browser is not blocking third-party cookies in privacy settings.

### Issue: AI Note generation takes >60 seconds or errors out
- **Cause**: Render Free container cold start or Gemini API rate limit.
- **Solution**:
  1. Check `https://<api>.onrender.com/health` to confirm the backend is awake.
  2. If using large transcripts (10,000+ words), allow 15–30 seconds for the Gemini Flash model to complete analysis.
  3. The backend automatically provides fallback notes if Gemini API experiences downtime.

### Issue: Neon connection timeout
- **Cause**: Inactive Neon compute endpoint woke from cold storage.
- **Solution**:
  - Neon automatically resumes suspended compute endpoints within 500ms. The backend connection pool includes automatic reconnect retry logic.
