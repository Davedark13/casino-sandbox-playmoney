import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');

export const env = {
  appMode: process.env.APP_MODE || 'test',
  port: Number(process.env.PORT || 8080),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  adminApiKey: process.env.ADMIN_API_KEY || 'change-me-admin-key',
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
  discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePriceId: process.env.STRIPE_PRICE_ID || '',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:8080',
  liveMoneyEnabled: process.env.LIVE_MONEY_ENABLED === 'true',
  legalApproved: process.env.LEGAL_APPROVED === 'true',
  withdrawDailyLimitCents: Number(process.env.WITHDRAW_DAILY_LIMIT_CENTS || 500000),
  withdrawCooldownMinutes: Number(process.env.WITHDRAW_COOLDOWN_MINUTES || 60),
  riskAutoblockThreshold: Number(process.env.RISK_AUTOBLOCK_THRESHOLD || 85),
  kycStoragePath: process.env.KYC_STORAGE_PATH || path.join(backendRoot, 'uploads', 'kyc'),
  kycMaxFileSizeMb: Number(process.env.KYC_MAX_FILE_SIZE_MB || 8),
  trustProxy: process.env.TRUST_PROXY === 'true',
  maxJsonBodyKb: Number(process.env.MAX_JSON_BODY_KB || 200)
};

export function assertLiveMoneyAllowed() {
  if (!(env.appMode === 'live' && env.liveMoneyEnabled && env.legalApproved)) {
    const error = new Error('Live money flows are disabled. Keep using APP_MODE=test until legal/compliance approval is complete.');
    error.statusCode = 403;
    throw error;
  }
}

export function assertEnvironmentSafety() {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (!env.redisUrl) {
    throw new Error('REDIS_URL is required');
  }

  if (env.appMode === 'live') {
    if (env.jwtSecret === 'dev-secret') {
      throw new Error('JWT_SECRET must be changed before APP_MODE=live');
    }
    if (env.adminApiKey === 'change-me-admin-key') {
      throw new Error('ADMIN_API_KEY must be changed before APP_MODE=live');
    }
  }
}
