# AI Client Tracker

A client/CRM tracker with an AI assistant, built with React + Vite (frontend), Express (backend), and Supabase (database).

## Local setup

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_KEY (Supabase → Project Settings → API)
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Leave VITE_API_BASE_URL empty for local dev (Vite proxies /api to :5000)
npm run dev
```

### 3. Open
- Frontend: http://localhost:5173
- Backend health check: http://localhost:5000/api/health

## Bulk importing clients
Add Client → Bulk import → upload a `.csv`, `.xlsx`, or `.xls` file (or download the template first). Required columns: `name`, `email`. Optional: `contact`, `phone`, `status`, `contract_end`, `contract_value`, `invoice_status`, `invoice_amount`, `notes`. Rows with missing/invalid data or duplicate emails (against your existing clients or within the file) are flagged and skipped automatically; you can review and deselect any row before importing.

## Deploying to Render

This repo includes a `render.yaml` Blueprint that defines two services:
- **ai-client-tracker-backend** — Node web service (Express + Supabase)
- **ai-client-tracker-frontend** — static site (Vite build)

### One-time setup
1. Push this repo to GitHub (`main` branch).
2. In the [Render dashboard](https://dashboard.render.com), click **New → Blueprint**, and connect your GitHub repo. Render will detect `render.yaml` automatically and create both services.
3. For each service, set the environment variables Render leaves blank (marked `sync: false` in `render.yaml`) under **Environment** in the Render dashboard:
   - **Backend:** `SUPABASE_URL`, `SUPABASE_KEY`, and `FRONTEND_URL` (set this to your frontend's Render URL once it's live, e.g. `https://ai-client-tracker-frontend.onrender.com`, to lock down CORS).
   - **Frontend:** `VITE_API_BASE_URL` — set to your backend's Render URL + `/api`, e.g. `https://ai-client-tracker-backend.onrender.com/api`.
4. Trigger a manual deploy once after setting env vars (Render → service → **Manual Deploy**) so the frontend build picks up `VITE_API_BASE_URL`.

### Auto-deploy on push
Both services have `autoDeploy: true`, which is Render's default once a service is linked to a GitHub branch — every push to `main` triggers a new build and deploy automatically. No extra CI/CD config needed.

### Health check
Render polls `GET /api/health` on the backend to know when a deploy is healthy.
