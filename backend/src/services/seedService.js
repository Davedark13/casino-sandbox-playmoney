import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { creditWallet } from './walletService.js';
import { evaluateUserRisk } from './fraudService.js';

const demoPassword = 'sandbox-demo-123';
const passwordHash = await bcrypt.hash(demoPassword, 12);

const testUsers = Array.from({ length: 12 }).map((_, index) => ({
  email: `sim${index + 1}@example.com`,
  username: `sim${index + 1}`,
  mode: 'test',
  passwordHash
}));

async function run() {
  for (const user of testUsers) {
    const userInsert = await pool.query(
      `INSERT INTO users (email, username, mode, role, password_hash)
       VALUES ($1, $2, $3, 'user', $4)
       ON CONFLICT (email) DO UPDATE
       SET username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [user.email, user.username, user.mode, user.passwordHash]
    );
    const userId = userInsert.rows[0].id;
    await pool.query(
      `INSERT INTO wallets (user_id, balance_cents, locked_balance_cents)
       VALUES ($1, 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    await pool.query(
      `INSERT INTO kyc_documents (user_id, status, document_type, storage_path, reviewer_note, reviewed_at)
       VALUES ($1, 'verified', 'passport', '/seed/passport.png', 'Seeded verified document', NOW())`,
      [userId]
    );

    const wallet = await pool.query(`SELECT balance_cents FROM wallets WHERE user_id = $1`, [userId]);
    if (Number(wallet.rows[0]?.balance_cents || 0) < 25_000) {
      await creditWallet(userId, 25_000 + Math.floor(Math.random() * 100_000), `seed-${userId}-${Date.now()}`, { seed: true });
    }

    await evaluateUserRisk(userId);
  }

  console.log(`Seed complete. Demo users password: ${demoPassword}`);
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
