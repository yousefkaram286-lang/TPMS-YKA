-- ============================================================
-- TPMS — LINE ↔ PRODUCT MAPPING TABLE + RLS (central master data)
-- ------------------------------------------------------------
-- Run this once in the Supabase SQL Editor (idempotent, safe to
-- re-run). Additive only — it CREATES the public.line_products
-- table used by the centralized (Supabase-backed) Line ↔ Product
-- mapping that drives the Production product filter, and enforces
-- the same role-aware RLS as 20260830_rbac.sql:
--   Admin → full CRUD, User → SELECT only.
--
-- No FK constraints are added on purpose: the app seeds the 
-- confirmed baseline with stable ids (lin-001…, prd-001…) and the
-- live tables may already contain operator-created rows (e.g.
-- different ids under the same display name). Join integrity is
-- enforced app-side via the in-memory lines/products maps. Nothing
-- here deletes, truncates or alters any other table.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.line_products (
  id          text PRIMARY KEY,
  line_id     text NOT NULL,
  product_id  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS line_products_line_id_idx
  ON public.line_products (line_id);

CREATE INDEX IF NOT EXISTS line_products_product_id_idx
  ON public.line_products (product_id);

ALTER TABLE public.line_products ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.line_products FROM anon;

DROP POLICY IF EXISTS tpms_admin_all   ON public.line_products;
DROP POLICY IF EXISTS tpms_user_select ON public.line_products;

CREATE POLICY tpms_admin_all ON public.line_products FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());

CREATE POLICY tpms_user_select ON public.line_products FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

COMMIT;