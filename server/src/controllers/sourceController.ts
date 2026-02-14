import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';
import { getIO } from '../services/socketService';
import { getCache, setCache, deleteCachePattern } from '../services/cacheService';
import axios from 'axios';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

const fetchMetadata = async (url: string) => {
    try {
        const { data } = await axios.get(url, { timeout: 5000 });
        const $ = cheerio.load(data);
        const title = $('head > title').text() || $('meta[property="og:title"]').attr('content');
        const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');
        return { title, description };
    } catch (e) {
        console.warn('Failed to fetch metadata:', e);
        return { title: null, description: null };
    }
};

export const createSource = async (req: Request, res: Response) => {
    try {
        const { vaultId, url, title, fileUrl } = req.body;
        const addedById = (req as AuthRequest).user?.id;

        if (!addedById) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        let finalTitle = title;
        let metadata = {};

        // For PDF uploads we get fileUrl but no url; use fileUrl as url so the required field is set
        const sourceUrl = url || fileUrl || '';
        if (!sourceUrl) {
            res.status(400).json({ error: 'Either url or fileUrl is required' });
            return;
        }

        // Edge Feature: Auto-fetch metadata if title is missing or just to enrich (only for web URLs)
        if (url && !fileUrl) {
            const extracted = await fetchMetadata(url);
            if (!finalTitle) finalTitle = extracted.title || url;
            metadata = { description: extracted.description };
        }

        const source = await prisma.source.create({
            data: {
                vaultId,
                url: sourceUrl,
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
                details: { title: finalTitle, url: sourceUrl }
            }
        });

        // Invalidate cache for this vault's sources
        await deleteCachePattern(`sources:${vaultId}`);

        // Emit real-time event
        try {
            getIO().to(vaultId).emit('source_added', source);
        } catch (e) {
            console.error("Socket emit failed", e);
        }

        res.json(source);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add source' });
    }
};

export const getSources = async (req: Request, res: Response) => {
    try {
        const { vaultId } = req.query;
        if (!vaultId || typeof vaultId !== 'string') {
            res.status(400).json({ error: 'Vault ID required' });
            return;
        }

        const cacheKey = `sources:${vaultId}`;
        const cachedSources = await getCache(cacheKey);

        if (cachedSources) {
            res.json(cachedSources);
            return;
        }

        const sources = await prisma.source.findMany({
            where: { vaultId },
            include: { annotations: true }
        });

        await setCache(cacheKey, sources, 300); // 5 min cache

        res.json(sources);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sources' });
    }
};
