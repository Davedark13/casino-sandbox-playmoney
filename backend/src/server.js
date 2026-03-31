import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { assertEnvironmentSafety, env } from './config/env.js';
import { pool } from './db/pool.js';
import { redis } from './db/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestContext } from './middleware/requestContext.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/games.js';
import healthRoutes from './routes/health.js';
import kycRoutes from './routes/kyc.js';
import paymentRoutes from './routes/payments.js';
import userRoutes from './routes/users.js';
import walletRoutes from './routes/wallet.js';
import withdrawalRoutes from './routes/withdrawals.js';
import { logInfo, logWarn } from './utils/logger.js';

const app = express();
const localhostOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8088']);
const allowedOrigins = new Set([...env.corsOrigins, ...(env.appMode === 'test' ? [...localhostOrigins] : [])]);
const jsonParser = express.json({ limit: `${env.maxJsonBodyKb}kb` });

assertEnvironmentSafety();
app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');

app.use(requestContext);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(Object.assign(new Error('Origin not allowed by CORS policy'), { statusCode: 403 }));
  }
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use((req, res, next) => (req.path === '/payments/webhook' ? next() : jsonParser(req, res, next)));

app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/wallet', walletRoutes);
app.use('/games', gameRoutes);
app.use('/kyc', kycRoutes);
app.use('/payments', paymentRoutes);
app.use('/withdrawals', withdrawalRoutes);
app.use('/admin', adminRoutes);

app.use(errorHandler);

Promise.all([pool.query('SELECT 1'), redis.ping()])
  .then(() => {
    if (!env.corsOrigins.length) {
      logWarn('server.cors_defaults', { allowedOrigins: [...allowedOrigins] });
    }
    app.listen(env.port, () => {
      logInfo('server.started', { port: env.port, appMode: env.appMode });
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
