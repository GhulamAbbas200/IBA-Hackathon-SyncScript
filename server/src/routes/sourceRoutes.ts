import { Router } from 'express';
import { createSource, getSources, updateSourceContent } from '../controllers/sourceController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/', authenticateToken, createSource);
router.get('/', authenticateToken, getSources);
router.put('/:id/content', authenticateToken, updateSourceContent);

export default router;
