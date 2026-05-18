import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { getAuthStatus, login, logout } from '../controllers/authController.js';

const router = Router();

router.get('/auth/status', asyncHandler(getAuthStatus));
router.post('/auth/login', asyncHandler(login));
router.post('/auth/logout', asyncHandler(logout));

export default router;
