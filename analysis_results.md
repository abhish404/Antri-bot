# 🔍 Azure Deployability Audit — WhatsApp Bot (Antri)

**Project**: WhatsApp venue queuing system with admin dashboard  
**Target**: Azure App Service (Node.js)  
**Date**: 2026-04-16

---

## Verdict

> [!WARNING]
> **Not deployable as-is.** There are **3 critical blockers** that will cause the app to crash or malfunction in production, plus **4 security issues** you should fix before showing this to a client. The good news: the codebase is clean, well-structured, and all issues are straightforward to fix. I estimate **~30 minutes** of work to make this production-ready.

---

## 🔴 Critical Blockers (App will break)

### 1. Firebase credentials loaded from a local JSON file
[firebase.js](file:///d:/Projects/WhatsappBot/config/firebase.js)

```js
const serviceAccount = require('../antri-asia-firebase.json'); // ← hardcoded file path
```

**Problem**: Azure App Service won't have this file unless you include it in the deployment package — but it's in `.gitignore`, so if you deploy via Git/GitHub Actions, it'll be missing and the app will crash on startup.

**Fix**: Load credentials from an environment variable instead:
```js
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
```

---

### 2. Session store is in-memory (MemoryStore)
[index.js:26-35](file:///d:/Projects/WhatsappBot/index.js#L26-L35)

```js
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  // ... no 'store' configured → defaults to MemoryStore
}));
```

**Problem**: Express's default `MemoryStore` has two issues:
- **Memory leak**: It doesn't prune expired sessions and will slowly consume memory until the process crashes.
- **Session loss**: Azure App Service restarts instances periodically (and scales horizontally). Each restart wipes all sessions, logging out every admin.

**Fix (for demo)**: This is probably acceptable for a short client demo since it's single-user. But add a comment acknowledging it, or use `connect-redis` / `connect-azure-tables` for production.

> [!NOTE]
> For a **quick client demo** this is tolerable — just know the admin will get logged out on every App Service restart (~every 24h or on deploy).

---

### 3. `BACKEND_URL` is hardcoded to `localhost`
[.env:15](file:///d:/Projects/WhatsappBot/.env#L15)

```
BACKEND_URL=http://localhost:3000
```

**Problem**: If any code references this URL for callback or webhook configuration, it won't work in Azure. I checked and it's not currently referenced in code, but it's misleading and could cause confusion.

**Fix**: Set it to your Azure App Service URL after deployment (e.g., `https://antri-bot.azurewebsites.net`).

---

## 🟠 Security Issues (Fix before client demo)

### 1. 🔑 Admin credentials in `.env` with weak defaults
[routes/auth.js:9-10](file:///d:/Projects/WhatsappBot/routes/auth.js#L9-L10)

```js
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Varma@admin';
```

**Problem**: Hardcoded fallback credentials. If env vars aren't set on Azure, anyone who guesses `Admin/Varma@admin` gets full access. Also, the actual `.env` values appear to be these same weak credentials.

**Fix**: Use strong passwords in Azure App Service → Configuration → Application Settings. Remove the fallback defaults.

---

### 2. 🍪 Session cookie not marked `secure`
[index.js:33](file:///d:/Projects/WhatsappBot/index.js#L33)

```js
secure: false, // Set to true if behind HTTPS
```

**Problem**: Azure App Service serves HTTPS by default. With `secure: false`, the session cookie will work but can be intercepted if someone accesses via HTTP.

**Fix**: Set `secure: true` and also add `app.set('trust proxy', 1)` since Azure sits behind a reverse proxy.

---

### 3. 🔐 WhatsApp Access Token exposed
[.env:11](file:///d:/Projects/WhatsappBot/.env#L11)

Your `WA_TOKEN` is a long-lived Facebook Graph API token sitting in plaintext in `.env`. While `.env` is gitignored, make sure:
- It's configured as an **Azure App Setting** (which are encrypted at rest)
- The token hasn't been committed to Git history previously

---

### 4. 📋 Firebase service account key committed to repo
[antri-asia-firebase.json](file:///d:/Projects/WhatsappBot/antri-asia-firebase.json)

The file is in `.gitignore`, but if it was ever committed before being gitignored, the private key is in your Git history. **Check this.**

---

## 🟡 Production Hardening (Nice to have)

| # | Issue | File | Impact |
|---|-------|------|--------|
| 1 | No health check endpoint | `index.js` | Azure App Service pings `/` to check if app is alive — your `/` redirects to `login.html` (302), which works but isn't ideal. Add a `GET /health` → 200 endpoint. |
| 2 | `node-cron` timezone handling | `index.js:56` | `node-cron` v3's `timezone` option requires `luxon` — **verify this works on your local machine**. If the cron silently fails, codes won't rotate at midnight. |
| 3 | No rate limiting on webhook | `routes/webhook.js` | A bad actor could spam your webhook and exhaust your WhatsApp API quota. Consider `express-rate-limit`. |
| 4 | `rotateBtn` referenced but commented out | `dashboard.html:139` | `const rotateBtn = document.getElementById('rotateBtn');` — this will be `null` since the button is in a comment block. Won't crash anything, but it's sloppy for a client demo. |
| 5 | No `engines` field in `package.json` | `package.json` | Azure may pick an incompatible Node.js version. Add `"engines": { "node": ">=18.0.0" }`. |

---

## ✅ What's Already Good

| Area | Status |
|------|--------|
| Project structure | Clean, well-organized MVC-ish layout |
| Code quality | Well-commented, consistent style, proper error handling |
| Firestore transactions | Token queue uses transactions for atomicity — solid |
| WhatsApp webhook | Correctly responds 200 immediately, processes async |
| Frontend | Premium dark-mode UI, responsive, QR code generation works |
| `.gitignore` | Covers `node_modules/`, `.env`, Firebase key |
| Date handling | IST timezone correctly handled via `Intl.DateTimeFormat` |
| Security (auth flow) | Session-based auth with proper guards on API routes |

---

## 📋 Recommended Fix Priority

> [!IMPORTANT]
> Fix these **in order** before deploying to Azure:

1. **Firebase credentials → env var** (critical — app won't start without it)
2. **Add `engines` field** to `package.json` (30 seconds, prevents version mismatch)
3. **Add `/health` endpoint** (2 lines of code, Azure needs it)
4. **Set `secure: true` + `trust proxy`** for session cookie
5. **Remove dead `rotateBtn` reference** from dashboard
6. **Configure all secrets as Azure App Settings** (not `.env` file)

---

## 🚀 Azure Deployment Checklist

Once fixes are applied:

```
1. az webapp create --name antri-bot --resource-group <rg> --plan <plan> --runtime "NODE:18-lts"
2. Configure App Settings in Azure Portal:
   - ADMIN_USERNAME, ADMIN_PASSWORD (strong values)
   - SESSION_SECRET (random 64-char string)
   - WA_TOKEN, PHONE_NUMBER_ID, VERIFY_TOKEN, WA_BOT_NUMBER
   - FIREBASE_SERVICE_ACCOUNT (JSON string of service account)
   - BACKEND_URL=https://antri-bot.azurewebsites.net
   - WEBSITES_PORT=8080  (or whatever PORT you use)
3. Deploy via Git push or zip deploy
4. Update Meta App Dashboard webhook URL to: https://antri-bot.azurewebsites.net/webhook
```

Want me to go ahead and fix all the critical issues?
