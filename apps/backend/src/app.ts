import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireDemoAuth } from './modules/auth/middleware/requireDemoAuth.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.use('/api', requireDemoAuth);
  app.use('/api', apiRoutes);

  app.use(errorHandler);

  return app;
}
