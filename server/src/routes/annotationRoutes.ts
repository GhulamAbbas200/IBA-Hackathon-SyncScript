import { Router } from 'express';
import { createAnnotation, getAnnotations } from '../controllers/annotationController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/', authenticateToken, createAnnotation);
router.get('/', authenticateToken, getAnnotations);

export default router;
