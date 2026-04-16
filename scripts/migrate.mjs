/**
 * Apply pending SQL migrations to the Supabase Postgres instance.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate.mjs
 *
 * Migrations are applied in filename order. Already-applied migrations
 * are skipped via a simple applied_migrations tracking table.
 */

import { createRequire } from 'module'
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const { Client } = require('pg')

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations')

// Derive the direct Postgres host from the Supabase project URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const projectRef  = supabaseUrl.replace('https://', '').replace('.supabase.co', '')

const DB_HOST = process.env.POSTGRES_HOST ?? `db.${projectRef}.supabase.co`
const DB_PASS = process.env.POSTGRES_PASSWORD

if (!DB_PASS) {
  console.error('POSTGRES_PASSWORD is not set in .env.local')
  console.error('')
  console.error('Add the following line to .env.local:')
  console.error('  POSTGRES_PASSWORD=<your Supabase database password>')
  console.error('')
  console.error('Find it at: Supabase Dashboard → Project Settings → Database → Connection string')
  process.exit(1)
}

const client = new Client({
  host: DB_HOST,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: DB_PASS,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
console.log(`Connected to ${DB_HOST}`)

// Ensure tracking table exists
await client.query(`
  CREATE TABLE IF NOT EXISTS public.applied_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`)

const { rows: applied } = await client.query(
  'SELECT filename FROM public.applied_migrations'
)
const appliedSet = new Set(applied.map((r) => r.filename))

const files = (await readdir(MIGRATIONS_DIR))
  .filter((f) => f.endsWith('.sql'))
  .sort()

// --baseline: mark all migrations as applied without running them.
// Use this once when the DB already has the schema but the tracker is empty.
const isBaseline = process.argv.includes('--baseline')

let ran = 0
for (const file of files) {
  if (appliedSet.has(file)) {
    console.log(`  skip  ${file}`)
    continue
  }

  if (isBaseline) {
    await client.query(
      'INSERT INTO public.applied_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
      [file]
    )
    console.log(`  mark  ${file}`)
    ran++
    continue
  }

  const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query(
      'INSERT INTO public.applied_migrations (filename) VALUES ($1)',
      [file]
    )
    await client.query('COMMIT')
    console.log(`  apply ${file}`)
    ran++
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`  FAIL  ${file}`)
    console.error(`        ${err.message}`)
    process.exit(1)
  }
}

if (ran === 0) {
  console.log('Nothing to apply — database is up to date.')
} else if (isBaseline) {
  console.log(`\nBaselined ${ran} migration(s). Run npm run migrate to apply any new ones.`)
} else {
  console.log(`\nApplied ${ran} migration(s).`)
}

await client.end()
