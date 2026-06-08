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
-- Drop existing tables for clean migration (comment out in production)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS weight_entries CASCADE;
DROP TABLE IF EXISTS bp_entries CASCADE;
DROP TABLE IF EXISTS mood_entries CASCADE;
DROP TABLE IF EXISTS water_entries CASCADE;
DROP TABLE IF EXISTS steps_entries CASCADE;
DROP TABLE IF EXISTS pregnancy_profiles CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  gender VARCHAR(20) NOT NULL,
  year_of_birth INTEGER NOT NULL,
  mobile VARCHAR(20),
  password_reset_required BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences (feature toggles)
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enable_blood_pressure BOOLEAN DEFAULT TRUE,
  enable_mood BOOLEAN DEFAULT TRUE,
  enable_water BOOLEAN DEFAULT TRUE,
  enable_steps BOOLEAN DEFAULT TRUE,
  enable_pregnancy BOOLEAN DEFAULT FALSE,
  enable_weight BOOLEAN DEFAULT TRUE,
  theme VARCHAR(20) DEFAULT 'dark',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BP Entries table
CREATE TABLE bp_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  systolic INTEGER NOT NULL,
  diastolic INTEGER NOT NULL,
  pulse INTEGER,
  session VARCHAR(20) DEFAULT 'morning',
  context TEXT[],
  notes TEXT,
  medication_taken BOOLEAN DEFAULT FALSE,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mood Entries table
CREATE TABLE mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mood VARCHAR(50) NOT NULL,
  day_rating INTEGER,
  sleep_quality INTEGER,
  energy_level INTEGER,
  notes TEXT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Water Entries table
CREATE TABLE water_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  unit VARCHAR(10) DEFAULT 'ml',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Steps Entries table
CREATE TABLE steps_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  steps INTEGER NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weight Entries table
CREATE TABLE weight_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  weight DECIMAL(5,2) NOT NULL,
  notes TEXT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pregnancy Profiles table
CREATE TABLE pregnancy_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  last_period_date DATE NOT NULL,
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Settings table
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  water_goal INTEGER DEFAULT 2500,
  steps_goal INTEGER DEFAULT 10000,
  weight_unit VARCHAR(10) DEFAULT 'kg',
  bp_unit VARCHAR(10) DEFAULT 'mmHg',
  theme VARCHAR(20) DEFAULT 'dark',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table for token auth
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_bp_entries_user_id ON bp_entries(user_id);
CREATE INDEX idx_bp_entries_recorded_at ON bp_entries(recorded_at);
CREATE INDEX idx_mood_entries_user_id ON mood_entries(user_id);
CREATE INDEX idx_mood_entries_recorded_at ON mood_entries(recorded_at);
CREATE INDEX idx_water_entries_user_id ON water_entries(user_id);
CREATE INDEX idx_water_entries_recorded_at ON water_entries(recorded_at);
CREATE INDEX idx_steps_entries_user_id ON steps_entries(user_id);
CREATE INDEX idx_steps_entries_recorded_at ON steps_entries(recorded_at);
CREATE INDEX idx_weight_entries_user_id ON weight_entries(user_id);
CREATE INDEX idx_weight_entries_recorded_at ON weight_entries(recorded_at);
CREATE INDEX idx_pregnancy_user_id ON pregnancy_profiles(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
`;

async function init() {
  const client = await pool.connect();
  try {
    console.log('Initializing unified schema...');
    await client.query(schema);
    console.log('Schema initialized successfully!');
  } catch (err) {
    console.error('Schema init error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

init().catch(console.error);