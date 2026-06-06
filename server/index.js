import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { query } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Simple token auth middleware
async function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const result = await query(
      `SELECT s.user_id FROM sessions s 
 WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.userId = result.rows[0].user_id;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth error' });
  }
}

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Auth Routes ───────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const result = await query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at',
      [name, email || null]
    );
    const user = result.rows[0];
    
    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );
    
    res.json({ user, token });
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    
    const result = await query(
      'SELECT id, name, email, created_at FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.rows[0];
    
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );
    
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    const token = req.headers['x-auth-token'];
    await query('DELETE FROM sessions WHERE token = $1', [token]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ─── BP Entries ───────────────────────────────────────────────
app.get('/api/bp', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, systolic, diastolic, pulse, context, notes, medication_taken, recorded_at, created_at
       FROM bp_entries WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 100`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch BP entries' });
  }
});

app.post('/api/bp', authMiddleware, async (req, res) => {
  try {
    const { systolic, diastolic, pulse, context, notes, medicationTaken, recordedAt } = req.body;
    
    if (!systolic || !diastolic) {
      return res.status(400).json({ error: 'Systolic and diastolic are required' });
    }
    
    const result = await query(
      `INSERT INTO bp_entries (user_id, systolic, diastolic, pulse, context, notes, medication_taken, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, systolic, diastolic, pulse, context, notes, medication_taken, recorded_at, created_at`,
      [req.userId, systolic, diastolic, pulse || null, context || [], notes || '', medicationTaken || false, recordedAt || new Date().toISOString()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save BP entry' });
  }
});

app.delete('/api/bp/:id', authMiddleware, async (req, res) => {
  try {
    await query(
      'DELETE FROM bp_entries WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete BP entry' });
  }
});

// ─── Weight Entries ───────────────────────────────────────────
app.get('/api/weight', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, weight, notes, recorded_at, created_at
       FROM weight_entries WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 100`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch weight entries' });
  }
});

app.post('/api/weight', authMiddleware, async (req, res) => {
  try {
    const { weight, notes, recordedAt } = req.body;
    
    if (!weight) {
      return res.status(400).json({ error: 'Weight is required' });
    }
    
    const result = await query(
      `INSERT INTO weight_entries (user_id, weight, notes, recorded_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, weight, notes, recorded_at, created_at`,
      [req.userId, weight, notes || '', recordedAt || new Date().toISOString()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save weight entry' });
  }
});

app.delete('/api/weight/:id', authMiddleware, async (req, res) => {
  try {
    await query(
      'DELETE FROM weight_entries WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete weight entry' });
  }
});

// ─── Settings ──────────────────────────────────────────────────
app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT weight_unit, bp_unit, theme FROM user_settings WHERE user_id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.json({ weightUnit: 'kg', bpUnit: 'mmHg', theme: 'light' });
    }
    const s = result.rows[0];
    res.json({ weightUnit: s.weight_unit, bpUnit: s.bp_unit, theme: s.theme });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/settings', authMiddleware, async (req, res) => {
  try {
    const { weightUnit, bpUnit, theme } = req.body;
    await query(
      `INSERT INTO user_settings (user_id, weight_unit, bp_unit, theme)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
 weight_unit = EXCLUDED.weight_unit,
       bp_unit = EXCLUDED.bp_unit,
       theme = EXCLUDED.theme,
       updated_at = CURRENT_TIMESTAMP`,
      [req.userId, weightUnit || 'kg', bpUnit || 'mmHg', theme || 'light']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ─── Dashboard Stats ───────────────────────────────────────────
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const bpResult = await query(
      `SELECT COUNT(*) as total, 
 AVG(systolic)::INTEGER as avg_systolic, 
       AVG(diastolic)::INTEGER as avg_diastolic,
       MAX(recorded_at) as last_recorded
       FROM bp_entries WHERE user_id = $1`,
      [req.userId]
    );
    const weightResult = await query(
      `SELECT COUNT(*) as total,
       AVG(weight)::DECIMAL(5,2) as avg_weight,
       MAX(recorded_at) as last_recorded
       FROM weight_entries WHERE user_id = $1`,
      [req.userId]
    );
    res.json({
      bp: bpResult.rows[0],
      weight: weightResult.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.listen(PORT, () => {
  console.log(`BP Tracker API running on port ${PORT}`);
});
