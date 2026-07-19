# InterviewReady AI Deployment Guide

This guide prepares InterviewReady AI for:

- Frontend: Vercel
- Backend: Render
- Database/Auth/Storage: Supabase

Do not commit real `.env` values. Add production secrets only in Render, Vercel, and Supabase dashboards.

## 1. Local Final Check

Start both the frontend and backend for local development:

```bash
npm run dev
```

The frontend and the API on port 5055 must both be running for resume analysis and AI features.

From the project root:

```bash
npm install
npm run build
npm run lint
```

From the backend folder:

```bash
cd server
npm install
npm start
```

Test the backend health endpoint locally:

```bash
curl http://localhost:5055/api/health
```

Expected response includes:

```json
{
  "ok": true,
  "service": "InterviewReady AI API"
}
```

## 2. Push to GitHub

Make sure these files are not committed:

- `.env`
- `.env.local`
- `.env.*.local`
- `server/.env`
- `server/.env.local`
- `server/.env.*.local`
- `node_modules`
- `server/node_modules`
- `dist`
- `.vercel`

Then push the project to GitHub.

## 3. Deploy Backend on Render

Backend Render settings:

- Root directory: server
- Build command: npm install
- Start command: npm start

Create a new Render Web Service from your GitHub repo and use the settings above.

## 4. Add Render Environment Variables

Render environment variables:

- NODE_ENV=production
- FRONTEND_URL=https://MY-VERCEL-URL.vercel.app
- SUPABASE_URL=
- SUPABASE_SERVICE_ROLE_KEY=
- OPENROUTER_API_KEY=
- OPENROUTER_MODEL=

Optional Render environment variables:

- SUPABASE_RESUME_BUCKET=resumes
- TAVILY_API_KEY=
- AI_PROVIDER=openrouter
- USE_AI=true
- AI_JSON_MODE=true
- AI_MAX_TOKENS=600
- AI_TEMPERATURE=0.25
- AI_REQUEST_TIMEOUT_MS=30000
- API_RATE_LIMIT=120
- AI_RATE_LIMIT=30
- RESUME_RATE_LIMIT=10

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` belongs only on Render.
- `OPENROUTER_API_KEY` belongs only on Render.
- Do not add backend secrets to Vercel.
- Leave `FRONTEND_URL` as the Vercel placeholder until the Vercel production URL exists, then update it and redeploy Render.

## 5. Test Render Health Endpoint

After Render deploys, open:

```text
https://MY-RENDER-BACKEND.onrender.com/api/health
```

Expected response includes:

```json
{
  "ok": true,
  "service": "InterviewReady AI API"
}
```

## 6. Deploy Frontend on Render

Create a Node.js Web Service from the repository root with these settings:

- Build command: `npm install && DEPLOY_TARGET=node npm run build`
- Start command: `npm start`
- Health check path: `/`

Set these environment variables on the frontend service:

- `DEPLOY_TARGET=node`
- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `VITE_SUPABASE_URL=`
- `VITE_SUPABASE_ANON_KEY=`
- `VITE_API_BASE_URL=https://MY-RENDER-BACKEND.onrender.com`

Render supplies `PORT`; the generated Nitro Node server reads both `PORT` and `HOST`. The build output entry is `.output/server/index.mjs`.

## 6A. Optional: Deploy Frontend on Vercel

Frontend Vercel settings:

- Framework: TanStack Start if available, otherwise Vite
- Build command: npm run build
- Output directory: leave empty / auto
- Install command: npm install

Create a new Vercel project from your GitHub repo. Use the project root as the Vercel root directory.

This project uses the standard TanStack Start Vite plugin. During Vercel builds, `vite.config.ts` enables Nitro and writes Vercel Build Output API files to `.vercel/output`. Do not force the output directory to `dist` for the Vercel production project.

## 7. Add Vercel Environment Variables

Vercel environment variables:

- VITE_SUPABASE_URL=
- VITE_SUPABASE_ANON_KEY=
- VITE_API_BASE_URL=https://interview2-k5w5.onrender.com

Notes:

- `VITE_SUPABASE_ANON_KEY` is the public Supabase anon key.
- Do not add `SUPABASE_SERVICE_ROLE_KEY` to Vercel.
- Do not add `OPENROUTER_API_KEY` to Vercel.
- Do not add `GROQ_API_KEY` or `TAVILY_API_KEY` to Vercel.

## 8. Update Supabase Auth URL Configuration

In Supabase Dashboard, go to Authentication -> URL Configuration.

Site URL:

```text
https://MY-VERCEL-URL.vercel.app
```

Redirect URLs:

```text
http://localhost:5173/**
http://localhost:8080/**
https://MY-VERCEL-URL.vercel.app/**
https://*.vercel.app/**
```

## 9. Update Render FRONTEND_URL

After Vercel gives you the final production URL:

1. Go to Render -> InterviewReady AI backend service -> Environment.
2. Set:

```text
FRONTEND_URL=https://MY-VERCEL-URL.vercel.app
```

3. Redeploy the Render backend.

This makes production CORS allow the final Vercel frontend.

## 10. Supabase Storage and RLS Check

The app uses:

- Storage bucket: `resumes`
- Resume file paths: `resumes/{userId}/{timestamp}-{fileName}`
- Tables: `profiles`, `resumes`, `interview_sessions`, `answers`, `speech_metrics`, `visual_metrics`

Run or verify `supabase/schema.sql` in your Supabase project. It creates the `resumes` bucket and RLS policies for user-owned rows and files.

Check these manually in Supabase:

- The `resumes` bucket exists.
- The bucket allows authenticated users to upload/read/update/delete only their own `resumes/{userId}/...` files.
- RLS is enabled on `profiles`, `resumes`, `interview_sessions`, `answers`, `speech_metrics`, and `visual_metrics`.
- Policies allow authenticated users to access only their own records.

## 11. Final Production Test Checklist

- Register works
- Login works
- Dashboard loads
- Resume upload works
- Resume analysis works
- Start interview works
- AI questions generate
- Text Mode works
- Voice Mode works
- Video Mode works
- Calibration works
- Camera analyzer works
- Final report works
- Session saves to Supabase
- History page shows saved sessions
- No CORS error in browser console
- No API key exposed in frontend build

## Secret Safety Checklist

Before pushing:

- Confirm `.env.example` files contain placeholders only.
- Confirm `.env`, `.env.local`, and `server/.env` are ignored.
- Rotate any backend secret that was ever committed or shared.
- Keep OpenRouter and Supabase service role keys only in Render.
- Use `npm run archive:source` to export committed source without ignored secrets, dependencies, logs, or build output.
- Changing `.gitignore` does not invalidate credentials that were previously exposed; rotate those credentials manually in every provider dashboard.
