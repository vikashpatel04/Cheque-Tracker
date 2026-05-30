-- RLS policies for Cheque Tracker

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheque_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Parties
CREATE POLICY "Users can only access own parties"
ON parties FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Cheques
CREATE POLICY "Users can only access own cheques"
ON cheques FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Cheque history (via cheque ownership)
CREATE POLICY "Users can only access own cheque history"
ON cheque_history FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM cheques
    WHERE cheques.id = cheque_history.cheque_id
    AND cheques.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cheques
    WHERE cheques.id = cheque_history.cheque_id
    AND cheques.user_id = auth.uid()
  )
);

-- Daily deposits
CREATE POLICY "Users can only access own deposits"
ON daily_deposits FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Settings
CREATE POLICY "Users can only access own settings"
ON settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Auto-create settings on user signup (hardened SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
