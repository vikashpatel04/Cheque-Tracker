-- Initial schema for Cheque Tracker

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE parties (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  name            text NOT NULL,
  contact_name    text,
  phone           text,
  bank_name       text,
  notes           text,
  is_active       boolean DEFAULT true,
  deleted_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE cheques (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid REFERENCES auth.users NOT NULL,
  party_id                uuid REFERENCES parties(id) NOT NULL,
  cheque_number           text NOT NULL,
  bank_name               text NOT NULL,
  amount                  numeric(12,2) NOT NULL,
  issue_date              date NOT NULL,
  due_date                date NOT NULL,
  status                  text NOT NULL DEFAULT 'PENDING',
  return_reason           text,
  auto_transition_blocked boolean DEFAULT false,
  notes                   text,
  deleted_at              timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE TABLE cheque_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cheque_id     uuid REFERENCES cheques(id) NOT NULL,
  from_status   text NOT NULL,
  to_status     text NOT NULL,
  changed_by    text NOT NULL,
  note          text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE daily_deposits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users NOT NULL,
  amount          numeric(12,2) NOT NULL,
  deposit_date    date NOT NULL DEFAULT CURRENT_DATE,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE settings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users NOT NULL UNIQUE,
  auto_pass_time    time DEFAULT '23:59',
  currency_symbol   text DEFAULT '₹',
  allocation_sort   text DEFAULT 'due_date_asc',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_parties_user_id ON parties(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cheques_user_id ON cheques(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cheques_status ON cheques(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_cheques_due_date ON cheques(due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_cheque_history_cheque_id ON cheque_history(cheque_id);
CREATE INDEX idx_daily_deposits_user_date ON daily_deposits(user_id, deposit_date);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER cheques_updated_at
  BEFORE UPDATE ON cheques
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
