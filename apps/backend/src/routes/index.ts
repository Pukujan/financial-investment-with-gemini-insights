import { Router } from 'express';
import authRoutes from '../modules/auth/routes/authRoutes.js';
import healthRoutes from '../modules/health/routes/healthRoutes.js';
import marketRoutes from '../modules/market/routes/marketRoutes.js';
import aiRoutes from '../modules/ai/routes/aiRoutes.js';
import portfolioRoutes from '../modules/portfolio/routes/portfolioRoutes.js';
import agentScrapeRoutes from '../modules/agent-scrape/routes/agentScrapeRoutes.js';
import aiEstimateRoutes from '../modules/ai-estimate/routes/aiEstimateRoutes.js';

const router = Router();

router.use(authRoutes);
router.use(healthRoutes);
router.use('/market', marketRoutes);
router.use('/ai-estimate', aiEstimateRoutes);
router.use('/agent-scrape', agentScrapeRoutes);
router.use('/ai', aiRoutes);
router.use('/portfolio', portfolioRoutes);

export default router;
