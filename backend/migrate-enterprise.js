/**
 * Enterprise migration: adds multi-tenant org structure + OTP sessions.
 * Safe to re-run (uses IF NOT EXISTS / DO $$ ... $$ blocks).
 * Usage: node backend/migrate-enterprise.js
 */
require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Organizations ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          VARCHAR(200) NOT NULL,
        slug          VARCHAR(100) UNIQUE NOT NULL,
        domain        VARCHAR(200),
        logo_url      TEXT,
        address       TEXT,
        phone         VARCHAR(50),
        email         VARCHAR(200),
        plan          VARCHAR(50)  DEFAULT 'standard',
        is_active     BOOLEAN      DEFAULT TRUE,
        max_employees INT          DEFAULT 100,
        created_at    TIMESTAMPTZ  DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  DEFAULT NOW()
      )
    `);

    // ── Branches ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name            VARCHAR(200) NOT NULL,
        address         TEXT,
        city            VARCHAR(100),
        country         VARCHAR(100) DEFAULT 'India',
        is_active       BOOLEAN      DEFAULT TRUE,
        created_at      TIMESTAMPTZ  DEFAULT NOW()
      )
    `);

    // ── Add organization_id + branch_id to users (nullable — platform admin has none) ──
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='users' AND column_name='organization_id'
        ) THEN
          ALTER TABLE users
            ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
            ADD COLUMN branch_id       UUID REFERENCES branches(id)       ON DELETE SET NULL;
        END IF;
      END $$
    `);

    // ── Add organization_id to visits ──────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='visits' AND column_name='organization_id'
        ) THEN
          ALTER TABLE visits ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
        END IF;
      END $$
    `);

    // ── Add organization_id to temi_robots ─────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='temi_robots' AND column_name='organization_id'
        ) THEN
          ALTER TABLE temi_robots ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
        END IF;
      END $$
    `);

    // ── Add organization_id to visitors ────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='visitors' AND column_name='organization_id'
        ) THEN
          ALTER TABLE visitors ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
        END IF;
      END $$
    `);

    // ── OTP Sessions ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS otp_sessions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visit_id        BIGINT REFERENCES visits(id) ON DELETE CASCADE,
        email           VARCHAR(200) NOT NULL,
        otp_hash        TEXT NOT NULL,
        attempts        INT  DEFAULT 0,
        max_attempts    INT  DEFAULT 3,
        expires_at      TIMESTAMPTZ NOT NULL,
        used            BOOLEAN DEFAULT FALSE,
        organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_otp_email_active
      ON otp_sessions(email, used, expires_at)`);

    // ── Extend role check constraint to include new roles ──────────────────
    await client.query(`
      DO $$ BEGIN
        BEGIN
          ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        EXCEPTION WHEN others THEN NULL;
        END;
        BEGIN
          ALTER TABLE users ADD CONSTRAINT users_role_check
            CHECK (role IN ('platform_super_admin','org_super_admin','org_admin','admin','employee','security'));
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
      END $$
    `);

    // ── Default org for existing data ──────────────────────────────────────
    const orgResult = await client.query(`
      INSERT INTO organizations (id, name, slug, email, plan)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        'Nanta Tech Limited',
        'nanta-tech',
        'admin@nanta.tech',
        'enterprise'
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `);

    const defaultOrgId = '00000000-0000-0000-0000-000000000001';

    // Backfill organization_id on existing rows
    await client.query(`UPDATE users       SET organization_id = $1 WHERE organization_id IS NULL AND role NOT IN ('platform_super_admin')`, [defaultOrgId]);
    await client.query(`UPDATE visits      SET organization_id = $1 WHERE organization_id IS NULL`, [defaultOrgId]);
    await client.query(`UPDATE temi_robots SET organization_id = $1 WHERE organization_id IS NULL`, [defaultOrgId]);
    await client.query(`UPDATE visitors    SET organization_id = $1 WHERE organization_id IS NULL`, [defaultOrgId]);

    // ── Platform super admin account ───────────────────────────────────────
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('Platform@2024', 12);
    await client.query(`
      INSERT INTO users (email, password_hash, name, role, department, is_active)
      VALUES ('platform@vms.com', $1, 'Platform Admin', 'platform_super_admin', 'Platform', TRUE)
      ON CONFLICT (email) DO UPDATE SET role = 'platform_super_admin', password_hash = $1
    `, [hash]);

    await client.query('COMMIT');
    console.log('✅  Enterprise migration complete.');
    console.log('   Platform admin: platform@vms.com / Platform@2024');
    console.log('   Default org:    Nanta Tech Limited (00000000-0000-0000-0000-000000000001)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

run();
