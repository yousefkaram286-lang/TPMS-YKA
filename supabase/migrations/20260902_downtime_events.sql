-- ============================================================
-- TPMS V3 — ADDITIVE: PRODUCTION DOWNTIME EVENTS COLUMN
-- ------------------------------------------------------------
-- Adds ONE nullable jsonb column to production_sessions.
--
-- Business: a Production session is for ONE selected Line, and downtime is
-- captured as MULTIPLE events (durationMinutes / reason / notes). These are
-- stored here, while the existing daily_line_time JSONB array continues to
-- carry the legacy per-line scalar aggregate (downtimeMinutes = summed events)
-- so Dashboard/Report keep working unchanged.
--
-- This is strictly ADDITIVE and non-destructive:
--   * no data transform, no deletes, no backfill
--   * historical sessions keep downtime_events = NULL -> reads as [] (legacy
--     scalar aggregate continues to display/aggregate safely)
-- ============================================================

BEGIN;

ALTER TABLE public.production_sessions
  ADD COLUMN IF NOT EXISTS downtime_events jsonb;

COMMIT;
