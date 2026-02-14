import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './authMiddleware';

const prisma = new PrismaClient();

export const authorizeVaultRole = (allowedRoles: ('OWNER' | 'CONTRIBUTOR' | 'VIEWER')[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        const vaultId = req.params.vaultId || req.body.vaultId || req.query.vaultId;

        if (!userId || !vaultId) {
            res.status(400).json({ error: 'Missing User ID or Vault ID' });
            return;
        }

        try {
            const vaultUser = await prisma.vaultUser.findUnique({
                where: {
                    userId_vaultId: {
                        userId,
                        vaultId: String(vaultId)
                    }
                }
            });

            if (!vaultUser) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            if (!allowedRoles.includes(vaultUser.role)) {
                res.status(403).json({ error: 'Insufficient permissions' });
                return;
            }

            next();
        } catch (error) {
            console.error('RBAC Error:', error);
            res.status(500).json({ error: 'Authorization failed' });
        }
    };
};
