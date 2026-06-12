# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# skope-app

The DPDP Consent Management Platform. See `../skope-implementation-plan.md` (Part B) for the full spec, `../DESIGN.md` for the visual system, and `../skope-landing-page/BRAND.md` for voice.

- Stack mirrors `../skope-landing-page`: Next 16, React 19, Tailwind v4, TypeScript strict, pnpm.
- Database is **Supabase Postgres via the transaction pooler** (`postgres` driver, `prepare: false`). Never commit `DATABASE_URL`.
- Every user-facing string follows BRAND.md: sentence case, plain verbs, no filler, no "!".
- The "easy integration" promise is load-bearing: tooltips + helper text on every term and field.
- **When you change user-facing behaviour** (a wizard step, page, plan limit, offer, or anything a customer touches), update `lib/assistant/product-context.ts` in the same change — the in-app assistant repeats that file to customers, so stale text there is a support bug.
- Commercial dates/offers live in `lib/entitlement/index.ts` (launch offer + payments pause); change them there, not in copy.
