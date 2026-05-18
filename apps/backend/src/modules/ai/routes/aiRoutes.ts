import { Router } from 'express';
import * as aiController from '../controllers/aiController.js';

const router = Router();

router.get('/insights', aiController.getInsights);
router.post('/stocks/:symbol/prediction', aiController.getPrediction);

export default router;
