import { Router } from 'express';
import { createVault, getVaults, getVaultMembers, inviteToVault } from '../controllers/vaultController';
import { authenticateToken } from '../middleware/authMiddleware';
import { authorizeVaultRole } from '../middleware/rbacMiddleware';

const router = Router();

router.post('/', authenticateToken, createVault);
router.get('/', authenticateToken, getVaults);
router.get('/:vaultId/members', authenticateToken, getVaultMembers);
router.post('/:vaultId/invite', authenticateToken, authorizeVaultRole(['OWNER', 'CONTRIBUTOR']), inviteToVault);

export default router;
