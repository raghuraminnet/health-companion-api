import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.PG_HOST || '76.13.219.191',
  port: parseInt(process.env.PG_PORT || '32773'),
  user: process.env.PG_USER || 'ckEboseeAziv0PsC',
  password: process.env.PG_PASSWORD || 'mQKydj5cyP4oJeSwiTBZ0Kb7r53HFaZI',
  database: process.env.PG_DATABASE || 'healthapp'
});

const schema = `
-- Users table (simple auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BP Entries table
CREATE TABLE IF NOT EXISTS bp_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  systolic INTEGER NOT NULL,
  diastolic INTEGER NOT NULL,
  pulse INTEGER,
  context TEXT[],
  notes TEXT,
  medication_taken BOOLEAN DEFAULT FALSE,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weight Entries table
CREATE TABLE IF NOT EXISTS weight_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  weight DECIMAL(5,2) NOT NULL,
  notes TEXT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Settings table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  weight_unit VARCHAR(10) DEFAULT 'kg',
  bp_unit VARCHAR(10) DEFAULT 'mmHg',
  theme VARCHAR(20) DEFAULT 'light',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table for simple token auth
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bp_entries_user_id ON bp_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_bp_entries_recorded_at ON bp_entries(recorded_at);
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON weight_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_entries_recorded_at ON weight_entries(recorded_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
`;

async function init() {
  const client = await pool.connect();
  try {
    console.log('Initializing database schema...');
    await client.query(schema);
    console.log('Schema initialized successfully!');
    
    // Check if we have any users
    const result = await client.query('SELECT id, name FROM users LIMIT 1');
    if (result.rows.length === 0) {
      console.log('No users found - creating default user');
      await client.query(
        "INSERT INTO users (id, name) VALUES (gen_random_uuid(), 'Default User') RETURNING id, name"
      );
    }
  } catch (err) {
    console.error('Schema init error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

init().catch(console.error);
