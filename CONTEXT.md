# RealFlip Pro — Context

## Goal
Full-stack SaaS platform for Czech real estate flipping: scraping 10+ portals, AI deal analysis, pipeline/CRM, call mode, portfolio tracking, market intelligence.

## Stack
- **Framework**: Next.js 16.2.10 (App Router), Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4, custom globals.css (emerald #10b981 palette, Geist font, glass/grid/noise)
- **Animation**: Framer Motion v12.42.2
- **Icons**: @phosphor-icons/react v2.1.10
- **DB**: Neon PostgreSQL (cloud) / SQLite (local) via Drizzle ORM
- **Auth**: NextAuth v5 (credentials + Google OAuth, JWT strategy)
- **Mapping**: Leaflet + OpenStreetMap

## Key Decisions
- JSON stored as text columns
- Leaflet CSS loaded via CDN
- Redesign experiment was fully reverted (commit 30b41ea = current HEAD)

## Infrastructure
- **DB**: Neon PostgreSQL + `data.db` (SQLite fallback)
- **Test account**: `cakmak@tuta.com` / `realflip2026`

## Progress

### Done (before redesign revert)
- Scraping engine: types, rate-limiter, deduplicator, base adapter, orchestrator, adapters (sreality, bazos, annonce, hyperinzerce, reality-cz, mmreality)
- Analysis engine: flip-calculator, market-data, location, condition detection
- Interactive analysis: flip calculator with toggles, cost breakdown, target price, comps, AI negotiation, save deal
- Price validation: MIN_REAL_ESTATE_PRICE, filterImages for placeholders, normalizeImageUrl for relative URLs
- Image/URL fixes: referrerPolicy, sreality URL format fix, onError fallbacks

## Relevant Files

### Core
- `src/db/index.ts` — DB connection (Neon or SQLite)
- `src/db/schema/*.ts` — SQLite dialect + PG alternatives in `src/db/pg/`
- `src/lib/auth.ts` — NextAuth config

### Scraping
- `src/lib/scraping/types.ts` — Portal configs, RawListing, filterImages, normalizeImageUrl
- `src/lib/scraping/orchestrator.ts` — Crawl orchestration + DB save
- `src/lib/scraping/adapters/*.ts` — 6 portal adapters

### Analysis
- `src/lib/analysis/flip-costs.ts` — Shared flip calculator
- `src/lib/analysis/analyzer.ts` — Full analysis engine
- `src/lib/analysis/market-data.ts` — City/segment market data
- `src/lib/scraping/market-price-service.ts` — Live sreality price fetching

### Pages
- `src/app/(dashboard)/analyzer/page.tsx` — URL analyzer + InteractiveAnalysis
- `src/app/(dashboard)/properties/page.tsx` — Property list
- `src/app/(dashboard)/properties/[id]/page.tsx` — Property detail
- `src/app/(dashboard)/dashboard/page.tsx` — Dashboard

## Deploy (Vercel + Neon)
- **Vercel**: `https://realflip.vercel.app`
- **Neon**: PostgreSQL, schema pushed via `drizzle-kit push --config=drizzle.config.prod.ts`
