import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { query, getClient } from './db.js';

const app = express();
const PORT = process.env.PORT || 38257;

app.use(cors());
app.use(express.json());

// ─── Password Hashing ──────────────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

function generateTempPassword() {
  return crypto.randomBytes(8).toString('hex');
}

// ─── Audit Trail ───────────────────────────────────────────────
async function logAudit(userId, action, entityType, entityId, details, req) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, entityType, entityId, JSON.stringify(details || {}), req?.ip || null, req?.headers?.['user-agent'] || null]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

// ─── Auth Middleware ───────────────────────────────────────────
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

// ─── Password Reset Required Middleware ───────────────────────
async function checkPasswordReset(req, res, next) {
  try {
    const result = await query(
      'SELECT password_reset_required FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length > 0 && result.rows[0].password_reset_required) {
      return res.status(403).json({ 
        error: 'PASSWORD_RESET_REQUIRED', 
        message: 'You must reset your password before continuing' 
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Check failed' });
  }
}

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Register ──────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    const { name, email, password, gender, yearOfBirth, mobile } = req.body;
    
    if (!name || !email || !password || !gender || !yearOfBirth) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Name, email, password, gender, and year of birth are required' });
    }
    
    if (!['male', 'female', 'other'].includes(gender)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Gender must be male, female, or other' });
    }
    
    const currentYear = new Date().getFullYear();
    if (yearOfBirth < 1900 || yearOfBirth > currentYear - 5) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid year of birth' });
    }
    
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    const passwordHash = hashPassword(password);
    
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, gender, year_of_birth, mobile, password_reset_required)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)
       RETURNING id, name, email, gender, year_of_birth, mobile, created_at`,
      [name, email, passwordHash, gender, yearOfBirth, mobile || null]
    );
    const user = userResult.rows[0];
    
    // Create default preferences (all trackers enabled except pregnancy)
    await client.query(
      `INSERT INTO user_preferences (user_id, enable_blood_pressure, enable_mood, enable_water, enable_steps, enable_pregnancy, enable_weight)
       VALUES ($1, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE)`,
      [user.id]
    );
    
    // Create default settings
    await client.query(
      `INSERT INTO user_settings (user_id, water_goal, steps_goal) VALUES ($1, 2500, 10000)`,
      [user.id]
    );
    
    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await client.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );
    
    await logAudit(user.id, 'USER_REGISTERED', 'user', user.id, { email, gender, yearOfBirth }, req);
    
    await client.query('COMMIT');
    
    res.json({ 
      user, 
      token,
      needsPasswordReset: false
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// ─── Login ────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const result = await query(
      'SELECT id, name, email, password_hash, gender, year_of_birth, mobile, password_reset_required, is_active, created_at FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      await logAudit(null, 'LOGIN_FAILED', 'user', null, { email, reason: 'User not found' }, req);
      return res.status(404).json({ error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    
    if (!user.is_active) {
      await logAudit(user.id, 'LOGIN_FAILED', 'user', user.id, { reason: 'Account inactive' }, req);
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    
    if (!verifyPassword(password, user.password_hash)) {
      await logAudit(user.id, 'LOGIN_FAILED', 'user', user.id, { reason: 'Invalid password' }, req);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );
    
    await logAudit(user.id, 'USER_LOGIN', 'user', user.id, { email }, req);
    
    delete user.password_hash;
    delete user.is_active;
    
    res.json({ 
      user, 
      token,
      needsPasswordReset: user.password_reset_required
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── Forgot Password ───────────────────────────────────────────
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const result = await query(
      'SELECT id, name FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.json({ message: 'If the email exists, a temporary password has been sent' });
    }
    
    const user = result.rows[0];
    const tempPassword = generateTempPassword();
    const passwordHash = hashPassword(tempPassword);
    
    await query(
      'UPDATE users SET password_hash = $1, password_reset_required = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, user.id]
    );
    
    await logAudit(user.id, 'PASSWORD_RESET_INITIATED', 'user', user.id, { email }, req);
    
    console.log(`[DEV] Temporary password for ${email}: ${tempPassword}`);
    
    res.json({ 
      message: 'If the email exists, a temporary password has been sent',
      tempPassword // Remove in production!
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Request failed' });
  }
});

// ─── Change Password ───────────────────────────────────────────
app.post('/api/auth/change-password', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!verifyPassword(currentPassword, userResult.rows[0].password_hash)) {
      await logAudit(req.userId, 'CHANGE_PASSWORD_FAILED', 'user', req.userId, { reason: 'Invalid current password' }, req);
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const newHash = hashPassword(newPassword);
    await query(
      'UPDATE users SET password_hash = $1, password_reset_required = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, req.userId]
    );
    
    await logAudit(req.userId, 'PASSWORD_CHANGED', 'user', req.userId, {}, req);
    
    await query('DELETE FROM sessions WHERE user_id = $1 AND expires_at > NOW()', [req.userId]);
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ─── Reset Password (after temp password login) ───────────────
app.post('/api/auth/reset-password', authMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    
    const newHash = hashPassword(newPassword);
    await query(
      'UPDATE users SET password_hash = $1, password_reset_required = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, req.userId]
    );
    
    await logAudit(req.userId, 'PASSWORD_RESET_COMPLETED', 'user', req.userId, {}, req);
    
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ─── Logout ────────────────────────────────────────────────────
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    const token = req.headers['x-auth-token'];
    await query('DELETE FROM sessions WHERE token = $1', [token]);
    await logAudit(req.userId, 'USER_LOGOUT', 'user', req.userId, {}, req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ─── Get Current User ─────────────────────────────────────────
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, gender, year_of_birth, mobile, password_reset_required, created_at FROM users WHERE id = $1',
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

// ─── Update Profile ───────────────────────────────────────────
app.put('/api/auth/profile', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { name, mobile } = req.body;
    
    await query(
      'UPDATE users SET name = COALESCE($1, name), mobile = COALESCE($2, mobile), updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [name, mobile, req.userId]
    );
    
    await logAudit(req.userId, 'PROFILE_UPDATED', 'user', req.userId, { name, mobile }, req);
    
    const result = await query(
      'SELECT id, name, email, gender, year_of_birth, mobile, password_reset_required, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── User Preferences ─────────────────────────────────────────
app.get('/api/preferences', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      // Create default preferences
      const newPrefs = await query(
        `INSERT INTO user_preferences (user_id, enable_blood_pressure, enable_mood, enable_water, enable_steps, enable_pregnancy, enable_weight)
         VALUES ($1, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE) RETURNING *`,
        [req.userId]
      );
      return res.json(newPrefs.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

app.put('/api/preferences', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { 
      enable_blood_pressure, enable_mood, enable_water, enable_steps, 
      enable_pregnancy, enable_weight, theme 
    } = req.body;
    
    await query(
      `INSERT INTO user_preferences (user_id, enable_blood_pressure, enable_mood, enable_water, enable_steps, enable_pregnancy, enable_weight, theme)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
       enable_blood_pressure = COALESCE($2, enable_blood_pressure),
       enable_mood = COALESCE($3, enable_mood),
       enable_water = COALESCE($4, enable_water),
       enable_steps = COALESCE($5, enable_steps),
       enable_pregnancy = COALESCE($6, enable_pregnancy),
       enable_weight = COALESCE($7, enable_weight),
       theme = COALESCE($8, theme),
       updated_at = CURRENT_TIMESTAMP`,
      [req.userId, enable_blood_pressure, enable_mood, enable_water, enable_steps, enable_pregnancy, enable_weight, theme]
    );
    
    await logAudit(req.userId, 'PREFERENCES_UPDATED', 'user_preferences', req.userId, req.body, req);
    
    const result = await query('SELECT * FROM user_preferences WHERE user_id = $1', [req.userId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ─── User Settings ─────────────────────────────────────────────
app.get('/api/settings', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.json({ water_goal: 2500, steps_goal: 10000, weight_unit: 'kg', bp_unit: 'mmHg', theme: 'dark' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/settings', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { water_goal, steps_goal, weight_unit, bp_unit, theme } = req.body;
    
    await query(
      `INSERT INTO user_settings (user_id, water_goal, steps_goal, weight_unit, bp_unit, theme)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
       water_goal = COALESCE($2, water_goal),
       steps_goal = COALESCE($3, steps_goal),
       weight_unit = COALESCE($4, weight_unit),
       bp_unit = COALESCE($5, bp_unit),
       theme = COALESCE($6, theme),
       updated_at = CURRENT_TIMESTAMP`,
      [req.userId, water_goal, steps_goal, weight_unit, bp_unit, theme]
    );
    
    await logAudit(req.userId, 'SETTINGS_UPDATED', 'user_settings', req.userId, req.body, req);
    
    const result = await query('SELECT * FROM user_settings WHERE user_id = $1', [req.userId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ─── Audit Logs ───────────────────────────────────────────────
app.get('/api/audit', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { action, limit = 50, offset = 0 } = req.query;
    
    let queryStr = 'SELECT * FROM audit_logs WHERE user_id = $1';
    const params = [req.userId];
    
    if (action) {
      queryStr += ' AND action = $2';
      params.push(action);
    }
    
    queryStr += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(queryStr, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ─── BP Entries ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
app.get('/api/bp', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await query(
      `SELECT * FROM bp_entries WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT $2 OFFSET $3`,
      [req.userId, parseInt(limit), parseInt(offset)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch BP entries' });
  }
});

app.post('/api/bp', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { systolic, diastolic, pulse, session, context, notes, medicationTaken, recordedAt } = req.body;
    
    if (!systolic || !diastolic) {
      return res.status(400).json({ error: 'Systolic and diastolic are required' });
    }
    
    const result = await query(
      `INSERT INTO bp_entries (user_id, systolic, diastolic, pulse, session, context, notes, medication_taken, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.userId, systolic, diastolic, pulse || null, session || 'morning', context || [], notes || '', medicationTaken || false, recordedAt || new Date().toISOString()]
    );
    
    await logAudit(req.userId, 'BP_ENTRY_CREATED', 'bp_entry', result.rows[0].id, { systolic, diastolic }, req);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save BP entry' });
  }
});

app.delete('/api/bp/:id', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    await query('DELETE FROM bp_entries WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    await logAudit(req.userId, 'BP_ENTRY_DELETED', 'bp_entry', req.params.id, {}, req);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete BP entry' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ─── Mood Entries ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
app.get('/api/mood', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await query(
      `SELECT * FROM mood_entries WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT $2 OFFSET $3`,
      [req.userId, parseInt(limit), parseInt(offset)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch mood entries' });
  }
});

app.post('/api/mood', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { mood, dayRating, sleepQuality, energyLevel, notes, recordedAt } = req.body;
    
    if (!mood) {
      return res.status(400).json({ error: 'Mood is required' });
    }
    
    const validMoods = ['good', 'stressed', 'calm', 'anxious', 'sad', 'energized'];
    if (!validMoods.includes(mood.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid mood value' });
    }
    
    const result = await query(
      `INSERT INTO mood_entries (user_id, mood, day_rating, sleep_quality, energy_level, notes, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.userId, mood.toLowerCase(), dayRating || null, sleepQuality || null, energyLevel || null, notes || '', recordedAt || new Date().toISOString()]
    );
    
    await logAudit(req.userId, 'MOOD_ENTRY_CREATED', 'mood_entry', result.rows[0].id, { mood }, req);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save mood entry' });
  }
});

app.delete('/api/mood/:id', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    await query('DELETE FROM mood_entries WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    await logAudit(req.userId, 'MOOD_ENTRY_DELETED', 'mood_entry', req.params.id, {}, req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete mood entry' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ─── Water Entries ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
app.get('/api/water', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await query(
      `SELECT * FROM water_entries WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT $2 OFFSET $3`,
      [req.userId, parseInt(limit), parseInt(offset)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch water entries' });
  }
});

app.post('/api/water', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { amount, unit, recordedAt } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    
    const result = await query(
      `INSERT INTO water_entries (user_id, amount, unit, recorded_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.userId, amount, unit || 'ml', recordedAt || new Date().toISOString()]
    );
    
    await logAudit(req.userId, 'WATER_ENTRY_CREATED', 'water_entry', result.rows[0].id, { amount }, req);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save water entry' });
  }
});

app.delete('/api/water/:id', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    await query('DELETE FROM water_entries WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    await logAudit(req.userId, 'WATER_ENTRY_DELETED', 'water_entry', req.params.id, {}, req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete water entry' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ─── Steps Entries ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
app.get('/api/steps', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await query(
      `SELECT * FROM steps_entries WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT $2 OFFSET $3`,
      [req.userId, parseInt(limit), parseInt(offset)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch steps entries' });
  }
});

app.post('/api/steps', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { steps, recordedAt } = req.body;
    
    if (!steps && steps !== 0) {
      return res.status(400).json({ error: 'Steps is required' });
    }
    
    const result = await query(
      `INSERT INTO steps_entries (user_id, steps, recorded_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.userId, parseInt(steps), recordedAt || new Date().toISOString()]
    );
    
    await logAudit(req.userId, 'STEPS_ENTRY_CREATED', 'steps_entry', result.rows[0].id, { steps }, req);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save steps entry' });
  }
});

app.delete('/api/steps/:id', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    await query('DELETE FROM steps_entries WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    await logAudit(req.userId, 'STEPS_ENTRY_DELETED', 'steps_entry', req.params.id, {}, req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete steps entry' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ─── Weight Entries ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
app.get('/api/weight', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await query(
      `SELECT * FROM weight_entries WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT $2 OFFSET $3`,
      [req.userId, parseInt(limit), parseInt(offset)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch weight entries' });
  }
});

app.post('/api/weight', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { weight, notes, recordedAt } = req.body;
    
    if (!weight) {
      return res.status(400).json({ error: 'Weight is required' });
    }
    
    const result = await query(
      `INSERT INTO weight_entries (user_id, weight, notes, recorded_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.userId, weight, notes || '', recordedAt || new Date().toISOString()]
    );
    
    await logAudit(req.userId, 'WEIGHT_ENTRY_CREATED', 'weight_entry', result.rows[0].id, { weight }, req);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save weight entry' });
  }
});

app.delete('/api/weight/:id', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    await query('DELETE FROM weight_entries WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    await logAudit(req.userId, 'WEIGHT_ENTRY_DELETED', 'weight_entry', req.params.id, {}, req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete weight entry' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ─── Pregnancy Profile ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
app.get('/api/pregnancy', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM pregnancy_profiles WHERE user_id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.json(null);
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pregnancy profile' });
  }
});

app.post('/api/pregnancy', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { lastPeriodDate, dueDate } = req.body;
    
    if (!lastPeriodDate) {
      return res.status(400).json({ error: 'Last period date is required' });
    }
    
    const result = await query(
      `INSERT INTO pregnancy_profiles (user_id, last_period_date, due_date)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET last_period_date = $2, due_date = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.userId, lastPeriodDate, dueDate || null]
    );
    
    await logAudit(req.userId, 'PREGNANCY_PROFILE_CREATED', 'pregnancy_profile', result.rows[0].id, { lastPeriodDate, dueDate }, req);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save pregnancy profile' });
  }
});

app.delete('/api/pregnancy', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    await query('DELETE FROM pregnancy_profiles WHERE user_id = $1', [req.userId]);
    await logAudit(req.userId, 'PREGNANCY_PROFILE_DELETED', 'pregnancy_profile', null, {}, req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete pregnancy profile' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ─── Stats Dashboard ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
app.get('/api/stats', authMiddleware, checkPasswordReset, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const bpResult = await query(
      `SELECT COUNT(*) as total, 
       AVG(systolic)::INTEGER as avg_systolic, 
       AVG(diastolic)::INTEGER as avg_diastolic,
       MAX(recorded_at) as last_recorded
       FROM bp_entries WHERE user_id = $1 AND recorded_at > NOW() - INTERVAL '${parseInt(days)} days'`,
      [req.userId]
    );
    
    const weightResult = await query(
      `SELECT COUNT(*) as total,
       AVG(weight)::DECIMAL(5,2) as avg_weight,
       MAX(recorded_at) as last_recorded
       FROM weight_entries WHERE user_id = $1 AND recorded_at > NOW() - INTERVAL '${parseInt(days)} days'`,
      [req.userId]
    );
    
    const moodResult = await query(
      `SELECT COUNT(*) as total,
       MAX(recorded_at) as last_recorded
       FROM mood_entries WHERE user_id = $1 AND recorded_at > NOW() - INTERVAL '${parseInt(days)} days'`,
      [req.userId]
    );
    
    const waterResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total,
       MAX(recorded_at) as last_recorded
       FROM water_entries WHERE user_id = $1 AND recorded_at > NOW() - INTERVAL '${parseInt(days)} days'`,
      [req.userId]
    );
    
    const stepsResult = await query(
      `SELECT COALESCE(SUM(steps), 0) as total,
       MAX(recorded_at) as last_recorded
       FROM steps_entries WHERE user_id = $1 AND recorded_at > NOW() - INTERVAL '${parseInt(days)} days'`,
      [req.userId]
    );
    
    res.json({
      bp: bpResult.rows[0],
      weight: weightResult.rows[0],
      mood: moodResult.rows[0],
      water: waterResult.rows[0],
      steps: stepsResult.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── Start Server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Health Companion API running on port ${PORT}`);
});