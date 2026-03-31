import crypto from 'crypto';

export function fairRoll(max = 100) {
  const value = crypto.randomInt(0, max);
  const proof = crypto.createHash('sha256').update(`${Date.now()}:${value}`).digest('hex');
  return { value, proof };
}

