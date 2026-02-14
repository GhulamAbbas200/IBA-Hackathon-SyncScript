import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';

const prisma = new PrismaClient();

import { getCache, setCache, deleteCachePattern } from '../services/cacheService';

// ... imports

export const createVault = async (req: Request, res: Response) => {
    try {
        const { name, description } = req.body;
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Transactional creation: Create Vault AND the initial VaultUser (OWNER)
        const vault = await prisma.vault.create({
            data: {
                name,
                description,
                users: {
                    create: {
                        userId,
                        role: 'OWNER'
                    }
                }
            }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                vaultId: vault.id,
                userId,
                action: 'VAULT_CREATED',
                details: { name }
            }
        });

        // Invalidate user's vault cache
        await deleteCachePattern(`vaults:${userId}*`);

        res.json(vault);
    } catch (error) {
        // ... error
    }
};

export const getVaults = async (req: Request, res: Response) => {
    try {
        const userId = (req as AuthRequest).user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const cacheKey = `vaults:${userId}`;
        const cachedVaults = await getCache(cacheKey);

        if (cachedVaults) {
            res.json(cachedVaults);
            return;
        }

        const vaults = await prisma.vault.findMany({
            where: {
                users: {
                    some: {
                        userId: userId
                    }
                }
            },
            include: {
                users: true
            }
        });

        await setCache(cacheKey, vaults, 300); // 5 min cache

        res.json(vaults);
    } catch (error) {
        // ... error
    }
};

export const getVaultMembers = async (req: Request, res: Response) => {
    try {
        const vaultId = req.params.vaultId as string;
        const userId = (req as AuthRequest).user?.id;
        if (!userId || !vaultId) {
            res.status(400).json({ error: 'Missing vault or user' });
            return;
        }

        const membership = await prisma.vaultUser.findUnique({
            where: { userId_vaultId: { userId, vaultId } },
        });
        if (!membership) {
            res.status(403).json({ error: 'Access denied to this vault' });
            return;
        }

        const members = await prisma.vaultUser.findMany({
            where: { vaultId },
            include: { user: { select: { id: true, name: true, email: true } } },
        });

        res.json(
            members.map((vu) => ({
                userId: vu.userId,
                name: vu.user.name,
                email: vu.user.email,
                role: vu.role,
                joinedAt: vu.joinedAt,
            }))
        );
    } catch (error) {
        console.error('getVaultMembers', error);
        res.status(500).json({ error: 'Failed to fetch members' });
    }
};

export const inviteToVault = async (req: Request, res: Response) => {
    try {
        const vaultId = req.params.vaultId as string;
        const { email, role } = req.body as { email?: string; role?: string };
        const userId = (req as AuthRequest).user?.id;

        if (!userId || !vaultId || !email || typeof email !== 'string') {
            res.status(400).json({ error: 'Vault ID and invitee email are required' });
            return;
        }

        const allowedRole = role === 'OWNER' || role === 'CONTRIBUTOR' || role === 'VIEWER' ? role : 'VIEWER';

        const inviter = await prisma.vaultUser.findUnique({
            where: { userId_vaultId: { userId, vaultId } },
        });
        if (!inviter || (inviter.role !== 'OWNER' && inviter.role !== 'CONTRIBUTOR')) {
            res.status(403).json({ error: 'Only owners and contributors can invite others' });
            return;
        }
        if (allowedRole === 'OWNER' && inviter.role !== 'OWNER') {
            res.status(403).json({ error: 'Only owners can invite as owner' });
            return;
        }

        const invitee = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
        if (!invitee) {
            res.status(404).json({ error: 'No user found with that email. They must register first.' });
            return;
        }

        if (invitee.id === userId) {
            res.status(400).json({ error: 'You are already in this vault' });
            return;
        }

        const existing = await prisma.vaultUser.findUnique({
            where: { userId_vaultId: { userId: invitee.id, vaultId } },
        });
        if (existing) {
            res.status(400).json({ error: 'This user is already a member' });
            return;
        }

        await prisma.vaultUser.create({
            data: { vaultId, userId: invitee.id, role: allowedRole },
        });

        await prisma.auditLog.create({
            data: {
                vaultId,
                userId,
                action: 'USER_INVITED',
                details: { inviteeEmail: invitee.email, role: allowedRole },
            },
        });

        await deleteCachePattern(`vaults:${invitee.id}*`);
        await deleteCachePattern(`vaults:${userId}*`);

        res.json({
            message: 'Invitation successful',
            user: { id: invitee.id, name: invitee.name, email: invitee.email, role: allowedRole },
        });
    } catch (error) {
        console.error('inviteToVault', error);
        res.status(500).json({ error: 'Failed to invite user' });
    }
};
