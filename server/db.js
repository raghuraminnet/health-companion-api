import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.PG_HOST || '76.13.219.191',
  port: parseInt(process.env.PG_PORT || '32773'),
  user: process.env.PG_USER || 'ckEboseeAziv0PsC',
  password: process.env.PG_PASSWORD || 'mQKydj5cyP4oJeSwiTBZ0Kb7r53HFaZI',
  database: process.env.PG_DATABASE || 'healthapp',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount });
  return res;
}

export async function getClient() {
  return pool.connect();
}

export default pool;
