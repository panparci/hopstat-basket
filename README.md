# HoopStat

React (Vite) frontend + Go API + Postgres.

## Local

1. Copy `.env.example` to `.env`
2. Tunnel VPS Postgres: `npm run db:tunnel`
3. `npm install`
4. `npm run dev` — http://127.0.0.1:3000 (Vite proxies `/api` to Go on `:8080`)

## Production (satu proses)

```bash
npm run prod
```

Go menyajikan `dist/` + `/api`. Di depan: Caddy/nginx HTTPS ke `:8080`. Set `HOOPSTAT_ENV=production`, `SESSION_SECRET`, `GEMINI_API_KEY`, `DATABASE_URL`.
