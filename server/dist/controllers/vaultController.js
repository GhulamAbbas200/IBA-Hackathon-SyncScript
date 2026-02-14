"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVaults = exports.createVault = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const cacheService_1 = require("../services/cacheService");
// ... imports
const createVault = async (req, res) => {
    try {
        const { name, description } = req.body;
        const userId = req.user?.id;
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
        await (0, cacheService_1.deleteCachePattern)(`vaults:${userId}*`);
        res.json(vault);
    }
    catch (error) {
        // ... error
    }
};
exports.createVault = createVault;
const getVaults = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const cacheKey = `vaults:${userId}`;
        const cachedVaults = await (0, cacheService_1.getCache)(cacheKey);
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
        await (0, cacheService_1.setCache)(cacheKey, vaults, 300); // 5 min cache
        res.json(vaults);
    }
    catch (error) {
        // ... error
    }
};
exports.getVaults = getVaults;
//# sourceMappingURL=vaultController.js.map