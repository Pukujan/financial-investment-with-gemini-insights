import { Router } from 'express';
import {
  deleteJob,
  getActiveJob,
  getEstimate,
  getJob,
  getAgentSources,
  getChartEvalHistoryHandler,
  getEstimateEvalHistoryHandler,
  getLastEval,
  getStatus,
  listGolden,
  postEval,
  postJob,
} from '../controllers/agentScrapeController.js';

const router = Router();

router.get('/status', getStatus);
router.get('/sources', getAgentSources);
router.get('/estimate', getEstimate);
router.post('/jobs', postJob);
router.get('/jobs/active', getActiveJob);
router.get('/jobs/:id', getJob);
router.delete('/jobs/:id', deleteJob);
router.get('/golden', listGolden);
router.post('/eval', postEval);
router.get('/eval/last', getLastEval);
router.get('/eval/estimates', getEstimateEvalHistoryHandler);
router.get('/eval/charts', getChartEvalHistoryHandler);

export default router;
