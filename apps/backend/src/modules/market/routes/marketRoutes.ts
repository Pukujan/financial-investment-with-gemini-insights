import { Router } from 'express';
import * as marketController from '../controllers/marketController.js';

const router = Router();

router.get('/settings', marketController.getSettings);
router.put('/settings', marketController.putSettings);
router.get('/stocks', marketController.getStocks);
router.get('/news', marketController.getNews);
router.get('/stocks/:symbol/timeseries', marketController.getTimeSeries);

export default router;
