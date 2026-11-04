import { Pool, type QueryResult, type QueryResultRow } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:psql0207@localhost:5432/leetcode_leaderboard'

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('[Database Pool Error]:', err)
})

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now()
  const res = await pool.query<T>(text, params)
  const duration = Date.now() - start
  if (process.env.NODE_ENV === 'development') {
    // console.log(`[SQL] ${text.slice(0, 80)}... (${duration}ms)`)
  }
  return res
}

export async function getClient() {
  const client = await pool.connect()
  return client
}

