# AIEdu 2.0 — Universal Smart Education

AIEdu is a universal education platform MVP for school pupils, college/technical-school learners, university students, teachers and independent learners.

## Included
- Responsive Uzbek-language frontend
- Supabase Auth registration/login
- Node.js + Express backend
- Role-ready profiles: student, teacher, admin
- Courses API and demo courses
- Protected AI endpoint; provider key remains server-side
- Supabase schema for profiles, courses, enrollments and quiz results

## Architecture
- Frontend: HTML, CSS, vanilla JavaScript (`public/`)
- Backend: Node.js + Express (`server.js`)
- Auth/database: Supabase
- AI: optional OpenAI-compatible Chat Completions API
- Hosting: Render or another Node.js host. GitHub Pages alone cannot run the backend.

## Local setup
Requirements: Node.js 20+ and a Supabase project.
1. Run `npm install`.
2. Copy `.env.example` to `.env` and fill in your Supabase URL, anon key and service role key.
3. Run `supabase/schema.sql` in Supabase Dashboard -> SQL Editor.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

Without Supabase variables, the landing page and demo course list work, but auth/protected APIs are unavailable.

## Deploy backend
1. Push this project to GitHub.
2. Create a Node.js Web Service on Render and connect the repository.
3. Build command: `npm install`; Start command: `npm start`.
4. Add environment variables from `.env.example` in the host dashboard. Never upload `.env`.
5. Check `https://YOUR-SERVICE/api/health`.

Express serves the frontend and backend together. Keep your current GitHub Pages demo separately if you wish.

## Real AI
Set `AI_API_KEY`, `AI_API_URL` (defaults to OpenAI Chat Completions endpoint), and `AI_MODEL` in the server environment. Choose a model available to your API account. API use may incur charges.

## Security
- Public registration creates student accounts only.
- Teacher/admin roles must be granted by a trusted admin in the database.
- Service-role key is server-only; never expose it in frontend code or commit it.
- This is an MVP, not a fully audited production service. Before public launch, add rate limiting, password reset, secure HttpOnly cookie sessions, audit logs, backups, monitoring, and privacy/terms pages.

## Structure
```text
AIEdu-2.0/
├── public/index.html
├── public/style.css
├── public/app.js
├── supabase/schema.sql
├── server.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```
