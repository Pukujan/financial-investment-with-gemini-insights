import { Router } from 'express';
import * as portfolioController from '../controllers/portfolioController.js';

const router = Router();

router.get('/', portfolioController.getPortfolio);
router.put('/', portfolioController.updatePortfolio);

export default router;
