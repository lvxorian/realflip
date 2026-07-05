# RealFlip Pro — Context

## Goal
Full-stack SaaS platform for Czech real estate flipping: scraping 10+ portals, AI deal analysis (GPT-4o), pipeline/CRM, call mode, portfolio tracking, market intelligence.

## Stack
- **Framework**: Next.js 16.2.10 (App Router), Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4, custom globals.css (emerald palette, Geist font, liquid glass)
- **Animation**: Framer Motion v12.42.2 (spring physics, magnetic buttons)
- **Icons**: @phosphor-icons/react v2.1.10 (CSR for client, SSR for server)
- **DB**: SQLite via better-sqlite3 + Drizzle ORM
- **Auth**: NextAuth v5 (credentials + Google OAuth, JWT strategy)
- **Queue**: BullMQ + Upstash Redis (inline fallback when REDIS_URL not set)
- **Mapping**: Leaflet + OpenStreetMap (CDN CSS + npm JS)

## Key Decisions
- SQLite for local dev (no Docker/PostgreSQL), PostgreSQL for cloud (Vercel + Neon)
- JSON stored as text columns (SQLite has no JSONB)
- No Redis fallback — scraping runs inline
- Leaflet CSS loaded via CDN `<link>` tag, marker icons fixed with CDN URLs
- `@phosphor-icons/react/ssr` import for server components (CSR import uses `createContext` without `"use client"` → breaks RSC)

## Infrastructure
- **Proxy**: `src/proxy.ts` (Node.js runtime, renamed from middleware.ts because Edge doesn't support `fs`)
- **DB**: `data.db` (SQLite, created by `drizzle-kit push`)
- **Test account**: `cakmak@tuta.com` / `realflip2026`
- **Scripts**: `npm run db:push` | `npm run db:seed` | `npm run build`

## Progress

### Done
- Next.js 16 + TypeScript + Tailwind v4 + Framer Motion initialized
- Global CSS: emerald accent (#10b981), Geist font, liquid glass (`.glass`/`.glass-strong`), grid bg, noise overlay, shimmer animation, dark Leaflet overrides, custom scrollbar, card gradient variants, pulsing dot
- Root layout with Geist Sans/Mono + Providers
- 9 DB schema files (SQLite dialect) + Drizzle config + `.env.example`
- NextAuth v5 (credentials + Google OAuth) with Drizzle adapter
- Auth guard proxy (Node.js runtime)
- API routes: login, register, dashboard/stats, scraping/trigger, settings/onboarding, properties/[id]
- UI components: Button (6 variants), Card, Badge, Input, Skeleton, CountUp, TiltCard, ScoreGauge, PriceTag, PropertyCard, MarketChart (Recharts), EmptyState, StatusDot, PropertyMap (Leaflet/Old detail page, external link to original listing, image gallery, flip calculator)
- DashboardLayout with collapsible sidebar
- All pages redesigned: landing, dashboard, properties (list + detail), leads/pipeline, call mode, contacts, portfolio, market, alerts, settings, onboarding, auth
- Scraping engine: types, rate-limiter, deduplicator, base adapter, orchestrator
- MockAdapter (bazos): generates 4 fake listings with images + realistic URLs — **confirmed working** (saves to DB, deduplication works)
- Analysis engine: flip-calculator, comparables
- AI analyst: GPT-4o JSON extraction
- Queue: BullMQ with Upstash Redis, inline fallback
- Database seeded: 15 properties (with imageUrls + real portal URLs), 4 contacts, 5 leads
- Build passes (19 routes, 0 TypeScript errors)

### What was just implemented (tento session)
1. **Seed update** — `imageUrls` (5 picsum.photos per property) + real portal URL patterns
2. **MockAdapter** — `src/lib/scraping/adapters/mock.ts`, registered in trigger route
3. **Test script** — `scripts/test-scraper.ts`, scraper pipeline verified end-to-end
4. **API route** — `GET /api/properties/[id]` (property + price history + analysis)
5. **ImageGallery** — `src/components/ui/image-gallery.tsx` (client component, carousel + thumbnails, shimmer fallback)
6. **FlipCalculator** — `src/components/ui/flip-calculator.tsx` (client island, interactive calc)
7. **PropertiesExplorer** — `src/components/ui/properties-explorer.tsx` (client island, filter/search/view toggle)
8. **Properties detail page** — server component with direct DB access, gallery, external link button, contact info
9. **Properties list page** — server component with DB + LEFT JOIN, filters from DB
10. **Build fix** — Phosphor icons must use `@phosphor-icons/react/ssr` in server components

## Relevant Files

### Core
- `src/db/index.ts` — SQLite connection
- `src/db/schema/*.ts` — All schemas (SQLite dialect)
- `src/lib/auth.ts` — NextAuth config
- `src/proxy.ts` — Auth guard proxy
- `scripts/seed.ts` — Database seeder

### Scraping
- `src/lib/scraping/types.ts` — Portal configs, RawListing interface
- `src/lib/scraping/orchestrator.ts` — Crawl orchestration + DB save
- `src/lib/scraping/adapters/base.ts` — Abstract PortalAdapter
- `src/lib/scraping/adapters/mock.ts` — MockAdapter for testing
- `src/app/api/scraping/trigger/route.ts` — POST endpoint
- `scripts/test-scraper.ts` — Direct test script

### Pages
- `src/app/(dashboard)/properties/page.tsx` — List (server component + PropertiesExplorer client island)
- `src/app/(dashboard)/properties/[id]/page.tsx` — Detail (server component + ImageGallery + FlipCalculator)
- `src/app/api/properties/[id]/route.ts` — API for property detail

### UI Components
- `src/components/ui/image-gallery.tsx` — Photo carousel with thumbnails
- `src/components/ui/flip-calculator.tsx` — Interactive investment calculator
- `src/components/ui/properties-explorer.tsx` — Filter/search + grid/list view
- `src/components/ui/property-map.tsx` — Leaflet map
- `src/components/ui/property-card.tsx` — Property card (used in grid view)

## Next Steps
1. Implement real scraper adapters (bazos — simple HTML, then sreality — requires JS)
2. Show photos from real scraped listings (imageUrls from scraper)
3. Deploy to Vercel + Neon (PostgreSQL)
4. Add Vercel Cron for scheduled scraping
5. Implement AI analysis pipeline (connect GPT-4o to new properties)
