# job-agent-dashboard

Next.js frontend for the job-agent backend.

## Local setup

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local`.
3. Set:
   `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`
4. Start the app:
   `npm run dev`

## Production deployment

Deploy to Vercel and set:

`NEXT_PUBLIC_API_BASE_URL=https://your-backend.up.railway.app`
