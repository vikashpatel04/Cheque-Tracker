-- Add configurable banks list to settings
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS banks text[] DEFAULT '{"SBI", "HDFC", "ICICI", "Bank of Baroda", "Axis Bank", "Kotak Mahindra", "Punjab National Bank"}'::text[];

COMMENT ON COLUMN public.settings.banks IS
  'User-configured list of banks for dropdown selection.';
