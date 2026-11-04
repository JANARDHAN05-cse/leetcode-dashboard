import fs from 'fs'
import path from 'path'
import { pool } from './client'

export async function runMigrations() {
  console.log('[Migration] Starting database migration process...')
  const client = await pool.connect()

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // 2. Read migration files
    const migrationsDir = path.join(__dirname, 'migrations')
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort()

    // 3. Get applied migrations
    const res = await client.query('SELECT filename FROM schema_migrations')
    const appliedFiles = new Set(res.rows.map((row) => row.filename))

    // 4. Run unapplied migrations
    for (const file of files) {
      if (appliedFiles.has(file)) {
        console.log(`[Migration] Skipping ${file} (already applied)`)
        continue
      }

      console.log(`[Migration] Applying ${file}...`)
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`[Migration] Successfully applied ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`[Migration] Failed applying ${file}:`, err)
        throw err
      }
    }

    console.log('[Migration] All migrations completed successfully.')
  } finally {
    client.release()
  }
}

// Allow direct CLI execution: tsx src/db/migrate.ts
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}

