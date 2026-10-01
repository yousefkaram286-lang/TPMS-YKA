-- ============================================================
-- TPMS — TROLLEY INPUT STORAGE (Production Line 1 & Line 2)
-- ------------------------------------------------------------
-- Factory-confirmed business rule:
--   Line 1 and Line 2 do NOT receive direct Presses input. The operator
--   enters TROLLEYS; the system derives Presses.
--
--        Presses  = Trolleys x 14
--        Produced = Presses x PiecesPerPress
--
--   1 Trolley = 14 Presses (fixed).
--   Trolleys accept decimals and are never rounded:
--        30    -> 420 presses
--        30.5  -> 427 presses
--        30.25 -> 423.5 presses   <-- FRACTIONAL presses must be storable
--        0.5   -> 7 presses
--
-- WHY presses MUST BE WIDENED
--   `productions.presses` was created as `integer`, so a legitimate
--   trolley-derived value such as 423.5 is rejected at insert time
--   (PostgREST/PostgreSQL "invalid input syntax" / cast error).
--   The same widening was already performed for `produced` in
--   20260916_production_produced_numeric.sql; `presses` was left integer
--   at that time because it was always a whole number. Trolley input
--   makes fractional Presses a normal, business-valid value.
--
-- HISTORICAL INTEGRITY (explicit non-goals)
--   * NO backfill. Existing rows keep presses exactly as recorded.
--   * NO trolley count is back-derived from historical Presses. A legacy
--     Presses value is not guaranteed to have come from trolleys, so
--     trolley_count stays NULL for every pre-existing record.
--   * NO rounding or truncation of presses or produced.
--   * int -> numeric is a lossless widening: every existing integer value
--     is preserved exactly.
--   * NOT NULL and DEFAULT 0 on `presses` are retained; only the type widens.
--
-- SCOPE (smallest possible change)
--   * `productions.presses`          integer -> numeric   (type only)
--   * `productions.trolley_count`    numeric, NULL, no default  (new)
--   * `productions.presses_per_trolley` numeric, NULL, no default (new)
--   * No RLS, policies, grants, indexes, triggers or other tables touched.
--   * The two new columns stay NULLABLE with NO DEFAULT precisely so that
--     "not captured through the Trolley flow" remains distinguishable from
--     0 and from any other real trolley value.
--
-- DEPLOYMENT ORDERING (IMPORTANT)
--   This migration must be applied to Supabase BEFORE the application
--   release that writes trolley_count / presses_per_trolley, otherwise
--   PostgREST rejects the unknown columns. The Angular app reads these
--   columns via `select('*')` and maps them in production.service.ts.
--
-- Run this ONCE in the Supabase SQL Editor of the target project:
--   ncjdluhagxordnxroofg
-- ============================================================

BEGIN;

-- 1. Allow fractional (trolley-derived) Presses.
--    Lossless: existing integer values are unchanged.
ALTER TABLE public.productions
  ALTER COLUMN presses TYPE numeric
  USING presses::numeric;

-- 2. Store the operator-entered Trolley count (decimals, never rounded).
--    NULL for every record not captured through the Trolley flow.
ALTER TABLE public.productions
  ADD COLUMN IF NOT EXISTS trolley_count numeric;

-- 3. Store the Presses-per-trolley snapshot (14) taken at entry time.
--    NULL whenever trolley_count is NULL, so the factor is never
--    attributed to a record that was not entered in trolleys.
ALTER TABLE public.productions
  ADD COLUMN IF NOT EXISTS presses_per_trolley numeric;

COMMIT;

-- ------------------------------------------------------------
-- VERIFICATION (read-only — run after applying):
--
--   -- presses is now numeric, and no historical value changed:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'productions'
--      AND column_name IN ('presses','produced','trolley_count','presses_per_trolley');
--   -- expect presses = numeric, produced = numeric,
--   --        trolley_count / presses_per_trolley = numeric, NULL, no default
--
--   -- NO historical row was back-filled with a trolley count:
--   SELECT count(*) FROM public.productions WHERE trolley_count IS NOT NULL;
--   -- expect 0 immediately after this migration
--
--   -- no fractional value was invented or truncated:
--   SELECT count(*) FROM public.productions WHERE presses <> trunc(presses);
--   -- expect 0 immediately after this migration
-- ------------------------------------------------------------
