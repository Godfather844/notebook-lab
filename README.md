# 📓 NOTEBOOK LAB (React)

Neobrutalist, NotebookLM-style study app — React (Vite) multi-page build.
Ask questions, attach PDFs, get exam-ready answers and auto-generated quizzes (with retry), plus a real MP4 video note renderer.

## Pages (hash routing)
- `#/login` — login / signup / guest
- `#/` — home: notebook grid + create modal (colour, mascot, language: english / hinglish / hindi)
- `#/chat?nb=<id>` — chat: PDF attach, exam-style answers, ❓ QUIZ artifact with 🔄 NEW QUIZ retry
- `#/profile` — stats, edit profile, logout
- `#/about` — how it works

## 🔐 API key safety
The Gemini API key is **never** in the client bundle or this public repo.
All Gemini calls go through the Vercel serverless proxy `api/gemini.js`, which reads the key from the `GEMINI_API_KEY` environment variable.

### Deploy to Vercel
1. Push this repo to GitHub.
2. `vercel link` → `vercel env add GEMINI_API_KEY` (paste your key) → `vercel --prod`.
   (Or add the env var in the Vercel dashboard: Project → Settings → Environment Variables.)

### Local dev
```bash
npm install
echo GEMINI_API_KEY=your_key_here > .env.local
npx vercel dev   # runs vite + the /api/gemini function together
```
Plain `npm run dev` works for UI-only tinkering, but Gemini calls need the function (use `vercel dev`).

## Storage
All notebooks/accounts live in `localStorage` per account (`notebook-lab-v3::<email>`), with legacy migration from the old single-file app.
