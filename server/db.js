import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'threatwatch',
  user:     process.env.PG_USER     || 'threatwatch',
  password: process.env.PG_PASSWORD || 'threatwatch_dev',
  max:      20,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 2000,
})

pool.on('error', (err) => {
  console.error('[db] unexpected pool error:', err.message)
  process.exit(-1)
})

pool.query('SELECT NOW()').then(() => {
  console.log('[db] PostgreSQL connected')
}).catch(err => {
  console.error('[db] connection failed:', err.message)
})

export const query = (text, params) => pool.query(text, params)
export default pool
