import { env } from '../config/env.js';
import { logInfo } from '../utils/logger.js';

export async function sendAlert(title, body, severity = 'medium') {
  logInfo('alert.created', { title, body, severity });

  if (!env.discordWebhookUrl) {
    return;
  }

  await fetch(env.discordWebhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'casino-playmoney',
      content: `**${severity.toUpperCase()}** ${title}\n${body}`
    })
  });
}
