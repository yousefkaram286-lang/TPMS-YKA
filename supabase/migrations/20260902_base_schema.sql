-- ============================================================
-- TPMS V3 — BASE SCHEMA MIGRATION (empty Supabase project)
-- ------------------------------------------------------------
-- Run this ONCE in the SQL Editor of the new Supabase project
-- before applying 20260830_rbac.sql (RLS) and
-- 20260902_line_products.sql (additive Line↔Product table).
--
-- Source of truth: every column is derived from the
-- mapToDb() / mapToModel() in the corresponding Angular service.
-- No seed data is included — use supabase-master-seed.util.ts.
-- No RLS policies — handled by 20260830_rbac.sql.
-- No FK constraints — join integrity enforced app-side.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. profiles  (auth.users ↔ app roles)
--    Columns from: auth.service.ts, user-management.service.ts
--    id = auth.users.id (uuid)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY,
  username     text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT '',
  role         text NOT NULL DEFAULT 'User',
  department   text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 2. lines
--    Columns from: line.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lines (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 3. products
--    Columns from: product.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  name_ar           text,
  type              text,
  pieces_per_press  numeric,
  product_area      numeric,
  standard_strength numeric NOT NULL DEFAULT 0,
  standard_height   numeric,
  standard_weight   numeric,
  dimensions        text,
  density_kg_per_m3 numeric,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 4. materials
--    Columns from: material.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.materials (
  id                   text PRIMARY KEY,
  name                 text NOT NULL,
  unit                 text NOT NULL,
  conversion_kg_per_m3 numeric,
  active               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 5. shifts
--    Columns from: shift.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shifts (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  start_time text NOT NULL,
  end_time   text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 6. machines
--    Columns from: machine.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.machines (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  line_id    text,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 7. product_machine_configs
--    Columns from: product-machine.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_machine_configs (
  id               text PRIMARY KEY,
  product_id       text NOT NULL,
  machine_id       text NOT NULL,
  pieces_per_press integer NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 8. productions
--    Columns from: production.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.productions (
  id              text PRIMARY KEY,
  session_id      text,
  date            text NOT NULL,
  shift_id        text NOT NULL DEFAULT '',
  line_id         text NOT NULL,
  machine_id      text,
  supervisor      text,
  product_id      text NOT NULL,
  pieces_per_press numeric,
  presses         integer NOT NULL DEFAULT 0,
  produced        integer NOT NULL DEFAULT 0,
  released_output numeric,
  output          numeric,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 9. production_sessions
--    Columns from: production-session.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.production_sessions (
  id               text PRIMARY KEY,
  date             text NOT NULL,
  shift_id         text NOT NULL,
  line_id          text NOT NULL,
  supervisor       text,
  released_output  numeric,
  overtime         boolean NOT NULL DEFAULT false,
  overtime_hours   numeric NOT NULL DEFAULT 0,
  daily_line_time  jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes            text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 10. quality_tests
--     Columns from: quality.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quality_tests (
  id                            text PRIMARY KEY,
  date                          text NOT NULL,
  product_id                    text NOT NULL,
  product_name                  text NOT NULL,
  line_id                       text,
  line_name                     text,
  test_date                     text NOT NULL,
  product_area_snapshot         numeric,
  compression_standard_snapshot numeric,
  standard_height_snapshot      numeric,
  standard_weight_snapshot      numeric,
  production_record_id          text,
  production_date               text,
  notes                         text,
  submission_id                 text,
  samples                       jsonb,
  strength                      numeric,
  standard_strength             numeric,
  load                          numeric,
  compression                   numeric,
  sample                        text,
  result                        text,
  decision_source               text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 11. material_records
--     Columns from: materials.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.material_records (
  id          text PRIMARY KEY,
  date        text NOT NULL,
  line_id     text NOT NULL,
  shift_id    text,
  product_id  text,
  mix_count   integer NOT NULL DEFAULT 0,
  materials   jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_cost  numeric NOT NULL DEFAULT 0,
  operator    text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 12. output_releases
--     Columns from: output-release.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.output_releases (
  id                text PRIMARY KEY,
  release_date      text NOT NULL,
  line_id           text,
  product_id        text,
  released_quantity numeric NOT NULL DEFAULT 0,
  data_source       text NOT NULL,
  legacy_session_id text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 13. recipes
--     Columns from: recipe.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recipes (
  id         text PRIMARY KEY,
  product_id text NOT NULL,
  items      jsonb NOT NULL DEFAULT '[]'::jsonb,
  demo       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- 14. unit_costs
--     Columns from: unit-cost.service.ts mapToDb/mapToModel
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unit_costs (
  id          text PRIMARY KEY,
  material_id text NOT NULL,
  unit_cost   numeric NOT NULL DEFAULT 0,
  unit        text NOT NULL,
  demo        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);

COMMIT;
