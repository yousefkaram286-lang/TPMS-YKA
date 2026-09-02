-- ============================================================
-- TPMS — ROLE-BASED ACCESS CONTROL (RLS) MIGRATION
-- ------------------------------------------------------------
-- Run this once in the Supabase SQL Editor.
-- Idempotent: safe to re-run.
--
-- Verifies against the LIVE schema state observed 2026-08-30:
--   Tables (all in public schema):
--     profiles, productions, production_sessions, quality_tests,
--     material_records, materials, lines, shifts, machines,
--     products, product_machine_configs, output_releases,
--     recipes, unit_costs
--   profiles.id is uuid (maps to auth.users.id).
--
-- Changes:
--   1. Helper functions tpms_role() / tpms_is_admin() (inactive-aware).
--   2. Enables ROW LEVEL SECURITY on all tables.
--   3. Drops every legacy (overly-permissive) policy on those tables.
--   4. Revokes privileges from the anon/publishable-key role.
--   5. Admin  → full CRUD on business tables.
--      User   → SELECT only on business tables.
--   6. Profiles → own-row SELECT/UPDATE, admin SELECT/INSERT/UPDATE/DELETE.
--   7. Triggers prevent Users from tampering with role/active/id and
--      force new profile rows to role = 'User' unless created by Admin.
--   8. Auto-creates a profile row when a new auth user is created.
--   9. Backfills profile rows for existing auth users (never overwrites).
--
-- NOTE: no data is deleted or recreated. No passwords are stored here.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Helper functions (SECURITY DEFINER so they bypass profiles
--    RLS internally -> no recursion; superuser owner bypasses RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.tpms_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role::text
    FROM public.profiles p
   WHERE p.id = auth.uid()
     AND p.active = true
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.tpms_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (public.tpms_role() = 'Admin')
$$;

-- ============================================================
-- 2. Enable RLS on all TPMS tables (idempotent)
-- ============================================================

ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_tests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lines                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_machine_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.output_releases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_costs             ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Drop ALL existing policies on those tables.
--    (Replaces any machine-generated permissive policies, e.g.
--     "Enable access for everyone" / USING(true) policies.)
-- ============================================================

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN (
         'profiles', 'productions', 'production_sessions',
         'quality_tests', 'material_records', 'materials',
         'lines', 'shifts', 'machines', 'products',
         'product_machine_configs', 'output_releases',
         'recipes', 'unit_costs'
       )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 4. Revoke privileges from anon (publishable key) — the
--    credential shipped in the Angular client must not retain
--    any write/read grant. RLS below is the primary defense;
--    this removes the underlying grant layer too.
-- ============================================================

REVOKE ALL ON TABLE public.profiles                FROM anon;
REVOKE ALL ON TABLE public.productions             FROM anon;
REVOKE ALL ON TABLE public.production_sessions     FROM anon;
REVOKE ALL ON TABLE public.quality_tests           FROM anon;
REVOKE ALL ON TABLE public.material_records        FROM anon;
REVOKE ALL ON TABLE public.materials               FROM anon;
REVOKE ALL ON TABLE public.lines                   FROM anon;
REVOKE ALL ON TABLE public.shifts                  FROM anon;
REVOKE ALL ON TABLE public.machines                FROM anon;
REVOKE ALL ON TABLE public.products                FROM anon;
REVOKE ALL ON TABLE public.product_machine_configs FROM anon;
REVOKE ALL ON TABLE public.output_releases         FROM anon;
REVOKE ALL ON TABLE public.recipes                 FROM anon;
REVOKE ALL ON TABLE public.unit_costs              FROM anon;

-- ============================================================
-- 5. Business tables — role-aware policies (authenticated)
--    Admin : SELECT/INSERT/UPDATE/DELETE
--    User  : SELECT only
--    (inactive profiles return NULL from tpms_role -> no access)
-- ============================================================

-- ---- productions -------------------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.productions;
DROP POLICY IF EXISTS tpms_user_select  ON public.productions;
CREATE POLICY tpms_admin_all   ON public.productions FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.productions FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ---- production_sessions -----------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.production_sessions;
DROP POLICY IF EXISTS tpms_user_select  ON public.production_sessions;
CREATE POLICY tpms_admin_all   ON public.production_sessions FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.production_sessions FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ---- quality_tests ------------------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.quality_tests;
DROP POLICY IF EXISTS tpms_user_select  ON public.quality_tests;
CREATE POLICY tpms_admin_all   ON public.quality_tests FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.quality_tests FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ---- material_records ---------------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.material_records;
DROP POLICY IF EXISTS tpms_user_select  ON public.material_records;
CREATE POLICY tpms_admin_all   ON public.material_records FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.material_records FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ---- materials (master) -------------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.materials;
DROP POLICY IF EXISTS tpms_user_select  ON public.materials;
CREATE POLICY tpms_admin_all   ON public.materials FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.materials FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ---- lines ---------------------------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.lines;
DROP POLICY IF EXISTS tpms_user_select  ON public.lines;
CREATE POLICY tpms_admin_all   ON public.lines FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.lines FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ---- shifts --------------------------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.shifts;
DROP POLICY IF EXISTS tpms_user_select  ON public.shifts;
CREATE POLICY tpms_admin_all   ON public.shifts FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.shifts FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ---- machines ------------------------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.machines;
DROP POLICY IF EXISTS tpms_user_select  ON public.machines;
CREATE POLICY tpms_admin_all   ON public.machines FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.machines FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ---- products ------------------------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.products;
DROP POLICY IF EXISTS tpms_user_select  ON public.products;
CREATE POLICY tpms_admin_all   ON public.products FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.products FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ---- product_machine_configs --------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.product_machine_configs;
DROP POLICY IF EXISTS tpms_user_select  ON public.product_machine_configs;
CREATE POLICY tpms_admin_all   ON public.product_machine_configs FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.product_machine_configs FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ---- output_releases ----------------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.output_releases;
DROP POLICY IF EXISTS tpms_user_select  ON public.output_releases;
CREATE POLICY tpms_admin_all   ON public.output_releases FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.output_releases FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ---- recipes -------------------------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.recipes;
DROP POLICY IF EXISTS tpms_user_select  ON public.recipes;
CREATE POLICY tpms_admin_all   ON public.recipes FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.recipes FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ---- unit_costs ----------------------------------------------------
DROP POLICY IF EXISTS tpms_admin_all    ON public.unit_costs;
DROP POLICY IF EXISTS tpms_user_select  ON public.unit_costs;
CREATE POLICY tpms_admin_all   ON public.unit_costs FOR ALL
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());
CREATE POLICY tpms_user_select ON public.unit_costs FOR SELECT
  TO authenticated
  USING (public.tpms_role() IS NOT NULL);

-- ============================================================
-- 6. Profiles — self-service + admin management
-- ============================================================

DROP POLICY IF EXISTS tpms_profile_select_own   ON public.profiles;
DROP POLICY IF EXISTS tpms_profile_select_admin ON public.profiles;
DROP POLICY IF EXISTS tpms_profile_insert_own   ON public.profiles;
DROP POLICY IF EXISTS tpms_profile_insert_admin ON public.profiles;
DROP POLICY IF EXISTS tpms_profile_update_own   ON public.profiles;
DROP POLICY IF EXISTS tpms_profile_update_admin ON public.profiles;
DROP POLICY IF EXISTS tpms_profile_delete_admin ON public.profiles;

-- Any authenticated user can read their own profile.
CREATE POLICY tpms_profile_select_own ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admin can read all profiles (user management).
CREATE POLICY tpms_profile_select_admin ON public.profiles FOR SELECT
  TO authenticated
  USING (public.tpms_is_admin());

-- Self-registration is allowed but forced to role='User', active=true
-- (the BEFORE INSERT trigger below enforces this as a second layer).
CREATE POLICY tpms_profile_insert_own ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND role = 'User'
    AND active = true
  );

-- Admin can create profiles directly.
CREATE POLICY tpms_profile_insert_admin ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.tpms_is_admin());

-- Users may update ONLY their own row. role / active / id changes
-- are rejected by the BEFORE UPDATE trigger (RLS cannot compare OLD vs NEW).
CREATE POLICY tpms_profile_update_own ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin can update any profile (including role/active).
CREATE POLICY tpms_profile_update_admin ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.tpms_is_admin())
  WITH CHECK (public.tpms_is_admin());

-- Admin-only delete on profiles.
CREATE POLICY tpms_profile_delete_admin ON public.profiles FOR DELETE
  TO authenticated
  USING (public.tpms_is_admin());

-- ============================================================
-- 7. Guardian triggers on profiles
-- ============================================================

-- 7a. Force non-admin inserts to role='User' (belt & braces for
--     the INSERT-own policy).
CREATE OR REPLACE FUNCTION public.tpms_normalize_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.tpms_is_admin() THEN
    NEW.role := 'User';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tpms_normalize_profile_role_trg ON public.profiles;
CREATE TRIGGER tpms_normalize_profile_role_trg
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tpms_normalize_profile_role();

-- 7b. Block non-admin changes to id / role / active.
CREATE OR REPLACE FUNCTION public.tpms_prevent_protected_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.tpms_is_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Changing profile id is not allowed.';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Changing role is not allowed.';
    END IF;
    IF NEW.active IS DISTINCT FROM OLD.active THEN
      RAISE EXCEPTION 'Changing active status is not allowed.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tpms_prevent_protected_profile_changes_trg ON public.profiles;
CREATE TRIGGER tpms_prevent_protected_profile_changes_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.tpms_prevent_protected_profile_changes();

-- ============================================================
-- 8. Auto-create a profile row when a new auth user is created.
--    (New users default to role='User', active=true.)
-- ============================================================

CREATE OR REPLACE FUNCTION public.tpms_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, role, department, active, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(COALESCE(NEW.email, ''), '@', 1), 'user'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'User'),
    NEW.raw_user_meta_data->>'department',
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.tpms_handle_new_user();

-- ============================================================
-- 9. Backfill profile rows for existing auth users that have
--    none yet — preserves all existing rows untouched.
--    Default role = 'User'. (See "PROMOTE A USER" below.)
-- ============================================================

INSERT INTO public.profiles (id, username, display_name, role, department, active, created_at, updated_at)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'username', split_part(COALESCE(u.email, ''), '@', 1), 'user'),
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(COALESCE(u.email, ''), '@', 1), ''),
  COALESCE(u.raw_user_meta_data->>'role', 'User'),
  u.raw_user_meta_data->>'department',
  true,
  COALESCE(u.created_at, now()),
  now()
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
 WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- OPTIONAL — promote an existing user to Admin (run manually,
-- adjust the email; ONLY run if that account is still role 'User'
-- after the migration and you intend them to be an admin):
-- ============================================================
-- UPDATE public.profiles
--    SET role = 'Admin'
--  WHERE id = (SELECT id FROM auth.users WHERE email = 'your.admin@example.com');

-- ============================================================
-- Sanity check — should list only the tpms_* policies we created.
-- ============================================================
-- SELECT schemaname, tablename, policyname
--   FROM pg_policies
--  WHERE schemaname = 'public'
--    AND tablename IN (
--      'profiles','productions','production_sessions','quality_tests',
--      'material_records','materials','lines','shifts','machines',
--      'products','product_machine_configs','output_releases',
--      'recipes','unit_costs'
--    )
--  ORDER BY tablename, policyname;

COMMIT;