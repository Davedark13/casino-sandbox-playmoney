import { env } from '../config/env.js';

export function getSecurityPosture() {
  const warnings = [];

  if (env.jwtSecret === 'dev-secret') {
    warnings.push('JWT secret uses the default development value.');
  }
  if (env.adminApiKey === 'change-me-admin-key') {
    warnings.push('Admin API key uses the default development value.');
  }
  if (!env.discordWebhookUrl) {
    warnings.push('Discord webhook alerts are not configured.');
  }
  if (!env.corsOrigins.length) {
    warnings.push('CORS_ORIGINS is not set; API falls back to localhost-friendly defaults.');
  }
  if (!env.trustProxy) {
    warnings.push('TRUST_PROXY is disabled; keep it enabled behind a reverse proxy.');
  }
  if (env.liveMoneyEnabled || env.legalApproved || env.appMode === 'live') {
    warnings.push('Live-money related flags are present; do not treat this repository as a production release.');
  }

  return {
    appMode: env.appMode,
    liveMoneyEnabled: env.liveMoneyEnabled,
    legalApproved: env.legalApproved,
    stripeConfigured: Boolean(env.stripeSecretKey && env.stripeWebhookSecret),
    discordAlertsConfigured: Boolean(env.discordWebhookUrl),
    trustProxy: env.trustProxy,
    corsOrigins: env.corsOrigins,
    kycMaxFileSizeMb: env.kycMaxFileSizeMb,
    maxJsonBodyKb: env.maxJsonBodyKb,
    warnings
  };
}
