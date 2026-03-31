import { env } from '../config/env.js';
import { verifyAccessToken } from '../services/authService.js';

function getBearerToken(req) {
  const header = req.header('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  return header.slice(7).trim();
}

function tryDecodeToken(req) {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  try {
    return verifyAccessToken(token);
  } catch (_error) {
    return null;
  }
}

export function requireUser(req, _res, next) {
  const claims = tryDecodeToken(req);
  if (claims?.sub) {
    req.userId = claims.sub;
    req.auth = claims;
    return next();
  }

  const userId = req.header('x-user-id');
  if (!userId) {
    return next(Object.assign(new Error('Missing bearer token or x-user-id header'), { statusCode: 401 }));
  }
  req.userId = userId;
  next();
}

export function requireAdmin(req, _res, next) {
  const claims = tryDecodeToken(req);
  if (claims?.role === 'admin') {
    req.adminId = claims.sub || 'admin';
    req.auth = claims;
    return next();
  }

  const apiKey = req.header('x-admin-key');
  if (apiKey !== env.adminApiKey) {
    return next(Object.assign(new Error('Invalid admin key'), { statusCode: 403 }));
  }
  req.adminId = 'admin';
  next();
}
