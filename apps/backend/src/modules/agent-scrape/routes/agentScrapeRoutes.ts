import { Router } from 'express';
import {
  deleteJob,
  getActiveJob,
  getEstimate,
  getJob,
  getAgentSources,
  getChartEvalHistoryHandler,
  getEstimateEvalHistoryHandler,
  getAiUsageLimits,
  postResetUsageLimits,
  getPromptEvalCooldown,
  getPromptEvalHistoryHandler,
  getPromptEvalRagLog,
  postChartEvalSync,
  postEstimateEvalSync,
  postPromptEvalExperiment,
  postPromptEvalSync,
  postPromptEvalTest,
  postPromptEvalJob,
  getPromptEvalJobHandler,
  getActivePromptEvalJobHandler,
  getPromptAbTestHistoryHandler,
  getPromptAbTestEstimate,
  postPromptAbTestSync,
  postPromptAbTest,
  postPromptAbTestJob,
  getPromptAbTestJobHandler,
  getActivePromptAbTestJobHandler,
  getLastEval,
  getStatus,
  listGolden,
  postEval,
  postJob,
  postLoadChartCache,
  getPromptRegistry,
} from '../controllers/agentScrapeController.js';

const router = Router();

router.get('/status', getStatus);
router.get('/prompts', getPromptRegistry);
router.get('/sources', getAgentSources);
router.get('/estimate', getEstimate);
router.post('/cache/load', postLoadChartCache);
router.post('/jobs', postJob);
router.get('/jobs/active', getActiveJob);
router.get('/jobs/:id', getJob);
router.delete('/jobs/:id', deleteJob);
router.get('/golden', listGolden);
router.post('/eval', postEval);
router.get('/eval/last', getLastEval);
router.get('/eval/estimates', getEstimateEvalHistoryHandler);
router.post('/eval/estimates/sync', postEstimateEvalSync);
router.get('/eval/charts', getChartEvalHistoryHandler);
router.post('/eval/charts/sync', postChartEvalSync);
router.get('/eval/prompt', getPromptEvalHistoryHandler);
router.get('/usage-limits', getAiUsageLimits);
router.post('/usage-limits/reset', postResetUsageLimits);
router.get('/eval/prompt/cooldown', getPromptEvalCooldown);
router.post('/eval/prompt/sync', postPromptEvalSync);
router.post('/eval/prompt/jobs', postPromptEvalJob);
router.get('/eval/prompt/jobs/active', getActivePromptEvalJobHandler);
router.get('/eval/prompt/jobs/:id', getPromptEvalJobHandler);
router.post('/eval/prompt/test', postPromptEvalTest);
router.get('/eval/prompt/:experimentId/rag', getPromptEvalRagLog);
router.post('/eval/prompt', postPromptEvalExperiment);
router.get('/eval/prompt-ab', getPromptAbTestHistoryHandler);
router.get('/eval/prompt-ab/estimate', getPromptAbTestEstimate);
router.post('/eval/prompt-ab/sync', postPromptAbTestSync);
router.post('/eval/prompt-ab/jobs', postPromptAbTestJob);
router.get('/eval/prompt-ab/jobs/active', getActivePromptAbTestJobHandler);
router.get('/eval/prompt-ab/jobs/:id', getPromptAbTestJobHandler);
router.post('/eval/prompt-ab', postPromptAbTest);

export default router;
