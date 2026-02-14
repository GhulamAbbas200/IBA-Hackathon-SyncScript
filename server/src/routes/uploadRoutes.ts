import { Router } from 'express';
import { getUploadUrl, getViewUrl } from '../controllers/uploadController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/presigned-url', authenticateToken, getUploadUrl);
router.post('/view-url', authenticateToken, getViewUrl);

export default router;
