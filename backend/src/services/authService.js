import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { writeAuditLog } from './auditService.js';

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 10;
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role || 'user',
      username: user.username
    },
    env.jwtSecret,
    { expiresIn: '12h' }
  );
}

function sanitizeUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    mode: row.mode,
    role: row.role || 'user',
    isBlocked: row.is_blocked,
    riskScore: row.risk_score,
    createdAt: row.created_at
  };
}

export async function registerUser({ email, username, password, mode = 'test' }) {
  if (!email || !username || !validatePassword(password)) {
    throw Object.assign(new Error('email, username and password (min. 10 chars) are required'), { statusCode: 400 });
  }

  const safeMode = 'test';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users (email, username, password_hash, mode, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING id, email, username, mode, role, is_blocked, risk_score, created_at`,
      [email.toLowerCase().trim(), username.trim(), passwordHash, safeMode]
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO wallets (user_id, balance_cents, locked_balance_cents)
       VALUES ($1, 0, 0)`,
      [user.id]
    );

    await client.query(
      `INSERT INTO kyc_documents (user_id, status, document_type, storage_path)
       VALUES ($1, 'pending', 'none', '/pending')`,
      [user.id]
    );

    await client.query('COMMIT');
    await writeAuditLog('user', user.id, 'auth.registered', user.id, { mode: safeMode });
    return {
      token: signToken(user),
      user: sanitizeUser(user)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw Object.assign(new Error('Email or username already exists'), { statusCode: 409 });
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function loginUser({ usernameOrEmail, password }) {
  if (!usernameOrEmail || !password) {
    throw Object.assign(new Error('usernameOrEmail and password are required'), { statusCode: 400 });
  }

  const result = await pool.query(
    `SELECT id, email, username, password_hash, mode, role, is_blocked, risk_score, created_at
     FROM users
     WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
     LIMIT 1`,
    [usernameOrEmail.trim()]
  );
  const user = result.rows[0];

  if (!user?.password_hash) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
  }

  if (user.is_blocked) {
    throw Object.assign(new Error('User is blocked'), { statusCode: 403 });
  }

  await writeAuditLog('user', user.id, 'auth.logged_in', user.id, {});
  return {
    token: signToken(user),
    user: sanitizeUser(user)
  };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
