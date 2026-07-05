# RealFlip Pro

Inteligentní SaaS platforma pro realitní investory (flipaře). Automatický scraping 10+ českých realitních portálů, AI analýza investičního potenciálu, pipeline management a call mode.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Framer Motion
- **Backend:** Next.js API Routes + Server Actions
- **Database:** PostgreSQL (Neon) + Drizzle ORM
- **Auth:** NextAuth v5 (credentials + Google OAuth)
- **AI:** OpenAI GPT-4o
- **Queue:** BullMQ + Upstash Redis (volitelně)
- **Maps:** Leaflet + OpenStreetMap
- **Charts:** Recharts
- **UI:** Custom design system (dark theme, glassmorphism)

## Struktura projektu

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Přihlášení / Registrace
│   ├── (dashboard)/        # Dashboard a všechny chráněné stránky
│   ├── api/                # API routes
│   └── onboarding/         # Onboarding wizard
├── components/
│   ├── ui/                 # Design system komponenty
│   └── shared/             # Layout, providers
├── db/                     # Databázová vrstva
│   └── schema/             # Drizzle ORM schema
├── lib/
│   ├── ai/                 # OpenAI integrace
│   ├── scraping/           # Scraping engine + adaptéry
│   ├── analysis/           # Flip kalkulátor, AVM
│   ├── queue/              # BullMQ queue
│   └── auth.ts             # NextAuth konfigurace
├── hooks/                  # Custom React hooks
├── types/                  # TypeScript typy + Zod schema
└── middleware.ts           # Auth middleware
```

## Rychlý start

```bash
# 1. Instalace závislostí
npm install

# 2. Nastavte env proměnné (zkopírujte .env.example)
cp .env.example .env.local
# Upravte DATABASE_URL, AUTH_SECRET, OPENAI_API_KEY

# 3. Vygenerujte DB migraci a push
npm run db:generate
npm run db:push

# 4. Seed demo dat (50+ nemovitostí)
npm run db:seed

# 5. Spusťte dev server
npm run dev
```

**Demo přístup:** `cakmak@tuta.com` / `realflip2026`

## Deployment (Vercel + Neon)

### 1. Neon databáze
- Založte účet na [neon.tech](https://neon.tech)
- Vytvořte projekt a získejte connection string
- Nastavte `DATABASE_URL` ve Vercel Environment Variables

### 2. Vercel
- Propojte GitHub repozitář s Vercel
- Nastavte všechny env proměnné:
  - `DATABASE_URL`
  - `AUTH_SECRET` (vygenerujte: `openssl rand -base64 32`)
  - `AUTH_URL` (URL vaší Vercel domény)
  - `OPENAI_API_KEY` (volitelné – pro AI analýzu)
  - `NEXT_PUBLIC_APP_URL`

### 3. Cron job (volitelný scraping)
V `vercel.json` je definován cron job každých 6 hodin. Pro aktivaci:
- Vytvořte cron job v dashboardu Vercelu → Cron Jobs
- Přidejte endpoint `/api/scraping/trigger`

### 4. Upstash Redis (volitelně – pro BullMQ)
- Založte účet na [upstash.com](https://upstash.com)
- Vytvořte Redis databázi (free tier: 10k req/den)
- Nastavte `REDIS_URL`

## Klíčové stránky

| Route | Účel |
|-------|------|
| `/` | Landing page |
| `/dashboard` | Hlavní dashboard s metrikami |
| `/properties` | Seznam scrapovaných nemovitostí |
| `/properties/[id]` | Detail + analýza + flip kalkulátor |
| `/leads` | Kanban pipeline |
| `/call-mode` | Fullscreen call mód |
| `/contacts` | CRM kontakty |
| `/portfolio` | Aktivní projekty |
| `/market` | Tržní analýzy |
| `/alerts` | Alerty a notifikace |
| `/settings` | Nastavení |
| `/onboarding` | Onboarding wizard |

## API Routes

| Route | Metoda | Účel |
|-------|--------|------|
| `/api/auth/*` | - | NextAuth handlers |
| `/api/auth/register` | POST | Registrace |
| `/api/dashboard/stats` | GET | Dashboard statistiky |
| `/api/scraping/trigger` | POST | Trigger scrapingu |
| `/api/settings/onboarding` | POST | Uložení onboarding dat |

## License

MIT
