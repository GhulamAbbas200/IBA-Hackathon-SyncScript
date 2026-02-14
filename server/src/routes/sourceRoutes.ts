import { Router } from 'express';
import { createSource, getSources } from '../controllers/sourceController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/', authenticateToken, createSource);
router.get('/', authenticateToken, getSources);

export default router;
