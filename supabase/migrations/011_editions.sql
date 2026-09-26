-- One codebase, two editions. See docs/editions.md.
--
-- Self-hosted (the default): instance_config.billing_enabled = false. Every
-- feature is free and there are no plans or limits; nothing below changes
-- how the app behaves.
--
-- Hosted: the operator sets billing_enabled = true. A user can then add or
-- change data only while they have an active entitlement (a trial, a
-- purchase or a complimentary grant). Without one the account is read-only:
-- every row stays visible and can be exported, but inserts, updates and
-- deletes are refused by row-level security.
--
-- Entitlements are written only with the service role (the payment webhook,
-- or an operator in the SQL editor). Users can read their own rows but can
-- never create or change one, so the public schema can't be used to grant a
-- plan to yourself.

-- ---------------------------------------------------------------------------
-- instance_config: a single row describing this installation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.instance_config (
  id                   boolean PRIMARY KEY DEFAULT true CHECK (id),
  billing_enabled      boolean NOT NULL DEFAULT false,
  trial_days           integer NOT NULL DEFAULT 0 CHECK (trial_days BETWEEN 0 AND 365),
  default_country_code text CHECK (default_country_code ~ '^[A-Z]{2}$'),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.instance_config IS
  'Single row. billing_enabled = false (default) means a self-hosted instance: no plans, no limits.';
COMMENT ON COLUMN public.instance_config.trial_days IS
  'Days of free access for new sign-ups when billing is enabled. 0 = no trial.';
COMMENT ON COLUMN public.instance_config.default_country_code IS
  'Country pre-selected at first sign-in when the browser does not reveal one.';

INSERT INTO public.instance_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER instance_config_updated_at
  BEFORE UPDATE ON public.instance_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.instance_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read the instance config"
ON public.instance_config FOR SELECT
USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.instance_config FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- entitlements: who may use the app while billing is enabled.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entitlements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  plan        text NOT NULL DEFAULT 'pro',
  source      text NOT NULL CHECK (source IN ('trial', 'purchase', 'comp')),
  starts_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  payment_ref text,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entitlements_period CHECK (expires_at IS NULL OR expires_at > starts_at)
);

COMMENT ON TABLE public.entitlements IS
  'Access grants on instances with billing enabled. Written only with the service role.';
COMMENT ON COLUMN public.entitlements.source IS
  'trial = free trial at sign-up; purchase = paid (payment_ref holds the provider id); comp = granted by the operator.';
COMMENT ON COLUMN public.entitlements.expires_at IS
  'NULL = never expires (e.g. a complimentary grant).';

CREATE INDEX IF NOT EXISTS idx_entitlements_user ON public.entitlements (user_id, expires_at);

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entitlements"
ON public.entitlements FOR SELECT
USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.entitlements FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- has_write_access: true on self-hosted instances, otherwise true while the
-- signed-in user has an active entitlement.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_write_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT NOT coalesce((SELECT billing_enabled FROM instance_config WHERE id), false)
      OR EXISTS (
        SELECT 1
        FROM entitlements e
        WHERE e.user_id = auth.uid()
          AND e.starts_at <= now()
          AND (e.expires_at IS NULL OR e.expires_at > now())
      );
$$;

REVOKE ALL ON FUNCTION public.has_write_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_write_access() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Writes need write access. RESTRICTIVE policies are ANDed with the existing
-- "own rows" policies, so they can only narrow access, never widen it.
-- Reads are untouched. The service role (auto-pass, cheque-mcp) bypasses RLS.
-- settings stay writable so an expired user can still change their region.
-- ---------------------------------------------------------------------------
CREATE POLICY "Inserts need an active plan" ON public.parties
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_write_access());
CREATE POLICY "Updates need an active plan" ON public.parties
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_write_access());
CREATE POLICY "Deletes need an active plan" ON public.parties
  AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_write_access());

CREATE POLICY "Inserts need an active plan" ON public.cheques
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_write_access());
CREATE POLICY "Updates need an active plan" ON public.cheques
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_write_access());
CREATE POLICY "Deletes need an active plan" ON public.cheques
  AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_write_access());

CREATE POLICY "Inserts need an active plan" ON public.cheque_history
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_write_access());

CREATE POLICY "Inserts need an active plan" ON public.daily_deposits
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.has_write_access());
CREATE POLICY "Updates need an active plan" ON public.daily_deposits
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_write_access());
CREATE POLICY "Deletes need an active plan" ON public.daily_deposits
  AS RESTRICTIVE FOR DELETE TO authenticated USING (public.has_write_access());

-- ---------------------------------------------------------------------------
-- Sign-up: same as migration 002, plus a free trial when this instance has
-- billing enabled and trial_days > 0.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_days integer;
BEGIN
  INSERT INTO public.settings (user_id) VALUES (NEW.id);

  SELECT CASE WHEN billing_enabled THEN trial_days ELSE 0 END
  INTO v_trial_days
  FROM public.instance_config
  WHERE id;

  IF coalesce(v_trial_days, 0) > 0 THEN
    INSERT INTO public.entitlements (user_id, source, expires_at, note)
    VALUES (NEW.id, 'trial', now() + make_interval(days => v_trial_days), 'Free trial');
  END IF;

  RETURN NEW;
END;
$$;
