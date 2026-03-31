import { redis } from '../db/redis.js';

export function rateLimit({ keyPrefix, limit, windowSeconds }) {
  return async (req, _res, next) => {
    try {
      const identifier = req.userId || req.ip;
      const key = `${keyPrefix}:${identifier}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }
      if (count > limit) {
        return next(Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 }));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

