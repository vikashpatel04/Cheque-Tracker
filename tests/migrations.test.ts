/**
 * Applies every migration in supabase/migrations to an in-memory Postgres
 * (PGlite) with small stand-ins for Supabase (roles, auth.users, auth.uid()),
 * then checks behaviour as real signed-in users, with row-level security on.
 */
import fs from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS = new URL('../supabase/migrations/', import.meta.url)

const U1 = '11111111-1111-1111-1111-111111111111'
const U2 = '22222222-2222-2222-2222-222222222222'
const U3 = '33333333-3333-3333-3333-333333333333'

const SUPABASE_STANDINS = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE ROLE supabase_auth_admin NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  CREATE SCHEMA extensions;
  CREATE SCHEMA cron;
  CREATE TABLE cron.job (jobid bigint, jobname text);
  CREATE FUNCTION cron.alter_job(job_id bigint, schedule text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`

let db: PGlite

/** Run a query as a signed-in user (role authenticated, auth.uid() = uid). */
async function asUser<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []) {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false);`)
  try {
    return await db.query<T>(sql, params)
  } finally {
    await db.exec('RESET ROLE;')
  }
}

/** Run a query as the database owner (like the service role or the SQL editor). */
const asAdmin = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params)

const writeAccess = async (uid: string) =>
  (await asUser<{ w: boolean }>(uid, 'SELECT has_write_access() AS w')).rows[0].w

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STANDINS)
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    // pg_cron, pg_net and pgcrypto aren't available here; gen_random_uuid() is built in.
    const sql = fs.readFileSync(new URL(file, MIGRATIONS), 'utf8').replace(/CREATE EXTENSION[^;]*;/gi, '')
    try {
      await db.exec(sql)
    } catch (e) {
      throw new Error(`${file}: ${(e as Error).message}`)
    }
  }
})

describe('region settings', () => {
  it('starts new users without a region or India-specific defaults', async () => {
    await asAdmin(`INSERT INTO auth.users (id, email) VALUES ($1, 'u1@example.com')`, [U1])
    const { rows } = await asAdmin<{ country_code: string | null; currency_symbol: string | null; banks: string[] }>(
      'SELECT country_code, currency_symbol, banks FROM settings WHERE user_id = $1',
      [U1]
    )
    expect(rows[0]).toEqual({ country_code: null, currency_symbol: null, banks: [] })
  })

  it('accepts a valid region and rejects bad values', async () => {
    await asUser(U1, `
      UPDATE settings SET country_code = 'IN', currency_code = 'INR', locale = 'en-IN', timezone = 'Asia/Kolkata',
        date_format = 'dd/MM/yyyy', week_starts_on = 1, cheque_validity_months = 3, currency_symbol = '₹'
      WHERE user_id = $1`, [U1])
    await expect(asUser(U1, `UPDATE settings SET date_format = 'd/M/yy' WHERE user_id = $1`, [U1])).rejects.toThrow(/date_format/)
    await expect(asUser(U1, `UPDATE settings SET country_code = 'india' WHERE user_id = $1`, [U1])).rejects.toThrow(/country_code/)
    await expect(asUser(U1, `UPDATE settings SET cheque_validity_months = 30 WHERE user_id = $1`, [U1])).rejects.toThrow(/validity/)
  })
})

describe('self-hosted edition (billing off)', () => {
  let chequeId: string

  it('has one config row with billing off and gives everyone write access', async () => {
    const { rows } = await asAdmin<{ billing_enabled: boolean }>('SELECT billing_enabled FROM instance_config')
    expect(rows).toEqual([{ billing_enabled: false }])
    expect(await writeAccess(U1)).toBe(true)
    const trials = await asAdmin<{ n: number }>('SELECT count(*)::int AS n FROM entitlements')
    expect(trials.rows[0].n).toBe(0)
  })

  it('lets users add data and change statuses', async () => {
    const party = await asUser<{ id: string }>(U1, `INSERT INTO parties (user_id, name) VALUES ($1, 'Party A') RETURNING id`, [U1])
    const cheque = await asUser<{ id: string }>(U1, `
      INSERT INTO cheques (user_id, party_id, cheque_number, bank_name, amount, issue_date, due_date)
      VALUES ($1, $2, '000123', 'Bank', 50000, '2026-09-01', '2026-09-20') RETURNING id`, [U1, party.rows[0].id])
    chequeId = cheque.rows[0].id
    await asUser(U1, `SELECT change_cheque_status($1, 'RETURNED', 'manual', NULL, 'Funds insufficient')`, [chequeId])
    await asUser(U1, `SELECT represent_cheque($1, '2026-10-05', NULL, true)`, [chequeId])
  })

  it('writes ISO dates and "Funded" in re-present history notes', async () => {
    const { rows } = await asAdmin<{ note: string | null }>(
      'SELECT note FROM cheque_history WHERE cheque_id = $1 ORDER BY created_at',
      [chequeId]
    )
    const notes = rows.map((r) => r.note)
    expect(notes.some((n) => n?.includes('was due 2026-09-20'))).toBe(true)
    expect(notes).toContain('Funded on re-presentation')
  })

  it("doesn't let users grant themselves a plan or change the instance", async () => {
    await expect(asUser(U1, `INSERT INTO entitlements (user_id, source) VALUES ($1, 'comp')`, [U1])).rejects.toThrow(/permission denied/)
    await expect(asUser(U1, 'UPDATE instance_config SET billing_enabled = false')).rejects.toThrow(/permission denied/)
  })
})

describe('hosted edition (billing on)', () => {
  beforeAll(async () => {
    await asAdmin(`UPDATE instance_config SET billing_enabled = true, trial_days = 14, default_country_code = 'IN'`)
  })

  it('gives new sign-ups the configured trial', async () => {
    await asAdmin(`INSERT INTO auth.users (id, email) VALUES ($1, 'u2@example.com')`, [U2])
    const { rows } = await asAdmin<{ source: string; long_enough: boolean }>(
      `SELECT source, expires_at > now() + interval '13 days' AS long_enough FROM entitlements WHERE user_id = $1`,
      [U2]
    )
    expect(rows).toEqual([{ source: 'trial', long_enough: true }])
    expect(await writeAccess(U2)).toBe(true)
    await asUser(U2, `INSERT INTO parties (user_id, name) VALUES ($1, 'Party B')`, [U2])
    const own = await asUser<{ n: number }>(U2, 'SELECT count(*)::int AS n FROM entitlements')
    expect(own.rows[0].n).toBe(1)
  })

  it('makes accounts without a plan read-only, but keeps their data visible', async () => {
    // U1 signed up while billing was off, so has no entitlement.
    expect(await writeAccess(U1)).toBe(false)
    const visible = await asUser<{ n: number }>(U1, 'SELECT count(*)::int AS n FROM cheques')
    expect(visible.rows[0].n).toBe(1)
    await expect(asUser(U1, `INSERT INTO parties (user_id, name) VALUES ($1, 'Party C')`, [U1])).rejects.toThrow(/row-level security/)
    await expect(asUser(U1, `SELECT record_deposit(1000, '2026-09-26')`)).rejects.toThrow(/row-level security/)
    const updated = await asUser(U1, `UPDATE cheques SET notes = 'x' WHERE user_id = $1`, [U1])
    expect(updated.affectedRows).toBe(0)
    // Settings stay editable so the user can still fix their region.
    await asUser(U1, `UPDATE settings SET timezone = 'Asia/Kolkata' WHERE user_id = $1`, [U1])
  })

  it('restores access with a complimentary grant', async () => {
    await asAdmin(`INSERT INTO entitlements (user_id, source, note) VALUES ($1, 'comp', 'Owner')`, [U1])
    expect(await writeAccess(U1)).toBe(true)
  })

  it('ignores expired purchases', async () => {
    await asAdmin(`INSERT INTO auth.users (id, email) VALUES ($1, 'u3@example.com')`, [U3])
    await asAdmin('DELETE FROM entitlements WHERE user_id = $1', [U3])
    await asAdmin(
      `INSERT INTO entitlements (user_id, source, starts_at, expires_at, payment_ref)
       VALUES ($1, 'purchase', now() - interval '40 days', now() - interval '10 days', 'pay_test')`,
      [U3]
    )
    expect(await writeAccess(U3)).toBe(false)
  })
})
