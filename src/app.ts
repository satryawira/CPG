import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { logger } from './config/logger';
import { openApiSpec } from './config/swagger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware';

// Route imports
import { authRoutes } from './modules/auth/auth.routes';
import { kycRoutes } from './modules/kyc/kyc.routes';
import { walletRoutes } from './modules/wallet/wallet.routes';
import { cashoutRoutes } from './modules/cashout/cashout.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { webhookRoutes } from './modules/webhooks/webhook.routes';

const app = express();

// Security
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  }),
);
app.use(
  cors({
    origin: env.NODE_ENV === 'production' ? env.APP_URL : true,
    credentials: true,
  }),
);

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Logging
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }),
);

// Global rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use(limiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API docs (disabled in production)
if (env.NODE_ENV !== 'production') {
  app.get('/', (_req, res) => res.redirect('/api-docs'));
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'Crypto Payment Gateway API',
      swaggerOptions: { persistAuthorization: true },
    }),
  );
}

// Routes
const apiPrefix = env.API_PREFIX;
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/kyc`, kycRoutes);
app.use(`${apiPrefix}/wallets`, walletRoutes);
app.use(`${apiPrefix}/cashouts`, cashoutRoutes);
app.use(`${apiPrefix}/admin`, adminRoutes);
app.use(`${apiPrefix}/webhooks`, webhookRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
