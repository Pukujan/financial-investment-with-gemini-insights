import { Router } from 'express';
import { getAgentScrapeEstimate, getTiers } from '../controllers/aiEstimateController.js';

const router = Router();

router.get('/tiers', getTiers);
router.get('/agent-scrape', getAgentScrapeEstimate);

export default router;
