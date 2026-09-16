-- ============================================================
-- TPMS — FRACTIONAL PRODUCTION STORAGE FIX
-- ------------------------------------------------------------
-- Confirmed business rule: Produced = Presses × PiecesPerPress.
-- Fractional Produced values are valid and MUST be preserved
-- exactly (e.g. 545 × 10.5 = 5722.5).
--
-- The original `productions.produced` column was created as
-- `integer`, which cannot faithfully store fractional Produced
-- values and rejects them at insert time under PostgREST.
--
-- Scope (smallest possible change):
--   * ONLY `public.productions.produced` is widened integer → numeric.
--   * `presses` (integer) and `pieces_per_press` (numeric) are UNCHANGED.
--   * Produced is NOT rounded/truncated anywhere.
--   * Existing integer values convert losslessly (int → numeric).
--   * NOT NULL / DEFAULT 0 and all other constraints remain intact.
--   * No RLS, indexes, triggers, or other tables are touched.
--
-- Run this ONCE in the Supabase SQL Editor of the target project:
--   ncjdluhagxordnxroofg
-- ============================================================

BEGIN;

ALTER TABLE public.productions
  ALTER COLUMN produced TYPE numeric
  USING produced::numeric;

COMMIT;