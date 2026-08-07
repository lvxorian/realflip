# GitHub Copilot Instructions — RealFlip

This file extends the project design context. See also `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, and `.impeccable.md`.

## Design Context

### Users

Czech real estate investors and flippers (solo founders, small teams) using the RealFlip dashboard daily. They hunt undervalued listings across 10+ portals, evaluate flip potential, negotiate with owners, and manage a deal pipeline.

The **Odhad (Valuation)** tool serves two moods:
1. **At speed** — evaluating a listing URL in seconds to decide "is this worth pursuing?"
2. **Ceremonially** — presenting a credible, defensible price estimate to a property owner during off-market / výkup negotiations. Here the interface must feel like a professional appraisal, not a toy.

### Brand Personality

**Důvěryhodný expert** — credible, precise, professional.

Voice: expert but plain Czech. No hype, no inflation. The product earns trust by being *honest about uncertainty*: it always shows a range plus a confidence level, and every number has a visible source. This honesty is the brand's differentiator versus "AI magic number" tools.

### Aesthetic Direction

Dark, data-dense UI consistent with the existing design system:
- Background `#0f0f11`, accent emerald `#10b981`, `rounded-2xl` cards, Geist font, Phosphor icons, glassmorphism in sidebar/nav only.
- **Odhad module**: banking-appraisal precision — tabular numerals for all prices (`font-variant-numeric: tabular-nums`), restrained motion, evidence-first layout. Think "a sober valuation report in a dark dashboard", NOT a flashy marketing page.
- Theme: dark only (users work evenings; the rest of the app is dark).

Anti-references: "AI slop" valuation generators with fake confidence (single magic number), credit-score-style ring gauges, glowing gradient heroes, side-stripe border callouts.

### Design Principles

1. **Důvěra nad efektem** — never fake precision. Range + confidence level + source transparency always.
2. **Evidence first** — every number has a source; hover/tooltip explains where it came from (realizované prodeje / ČSÚ / nabídky / vlastní DB).
3. **Rychlost i precize** — URL → estimate in 3 steps; progressive disclosure (hero + confidence first, comparables and sources behind expandable sections).
4. **Konzistence s design systémem** — dark, emerald accent, rounded-2xl, Geist, Phosphor icons, tabular numerals.
5. **Vstřícnost při chybějících datech** — never invent numbers; tell the user what is missing and let them fill it in before valuation runs.
