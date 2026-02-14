"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSources = exports.createSource = void 0;
const client_1 = require("@prisma/client");
const socketService_1 = require("../services/socketService");
const cacheService_1 = require("../services/cacheService");
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const prisma = new client_1.PrismaClient();
const fetchMetadata = async (url) => {
    try {
        const { data } = await axios_1.default.get(url, { timeout: 5000 });
        const $ = cheerio.load(data);
        const title = $('head > title').text() || $('meta[property="og:title"]').attr('content');
        const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
        return { title, description };
    }
    catch (e) {
        console.warn('Failed to fetch metadata:', e);
        return { title: null, description: null };
    }
};
const createSource = async (req, res) => {
    try {
        const { vaultId, url, title, fileUrl } = req.body;
        const addedById = req.user?.id;
        if (!addedById) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        let finalTitle = title;
        let metadata = {};
        // Edge Feature: Auto-fetch metadata if title is missing or just to enrich
        if (url && !fileUrl) {
            const extracted = await fetchMetadata(url);
            if (!finalTitle)
                finalTitle = extracted.title || url;
            metadata = { description: extracted.description };
        }
        const source = await prisma.source.create({
            data: {
                vaultId,
                url,
                title: finalTitle,
                fileUrl,
                addedById,
                metadata
            }
        });
        // Audit Log
        await prisma.auditLog.create({
            data: {
                vaultId,
                userId: addedById,
                action: 'SOURCE_ADDED',
                details: { title: finalTitle, url }
            }
        });
        // Invalidate cache for this vault's sources
        await (0, cacheService_1.deleteCachePattern)(`sources:${vaultId}`);
        // Emit real-time event
        try {
            (0, socketService_1.getIO)().to(vaultId).emit('source_added', source);
        }
        catch (e) {
            console.error("Socket emit failed", e);
        }
        res.json(source);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add source' });
    }
};
exports.createSource = createSource;
const getSources = async (req, res) => {
    try {
        const { vaultId } = req.query;
        if (!vaultId || typeof vaultId !== 'string') {
            res.status(400).json({ error: 'Vault ID required' });
            return;
        }
        const cacheKey = `sources:${vaultId}`;
        const cachedSources = await (0, cacheService_1.getCache)(cacheKey);
        if (cachedSources) {
            res.json(cachedSources);
            return;
        }
        const sources = await prisma.source.findMany({
            where: { vaultId },
            include: { annotations: true }
        });
        await (0, cacheService_1.setCache)(cacheKey, sources, 300); // 5 min cache
        res.json(sources);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch sources' });
    }
};
exports.getSources = getSources;
//# sourceMappingURL=sourceController.js.map