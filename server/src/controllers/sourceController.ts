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
            include: { annotations: true },
            orderBy: { createdAt: 'desc' }
        });

        await setCache(cacheKey, sources, 300); // 5 min cache

        res.json(sources);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sources' });
    }
};

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});

function keyFromFileUrl(fileUrl: string): string | null {
    try {
        const pathname = new URL(fileUrl).pathname;
        const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;
        return decodeURIComponent(key) || null;
    } catch {
        return null;
    }
}

export const updateSourceContent = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = (req as AuthRequest).user?.id;

        if (typeof id !== 'string') {
            res.status(400).json({ error: 'Invalid source ID' });
            return;
        }

        if (!content) {
            res.status(400).json({ error: 'Content is required' });
            return;
        }

        const source = await prisma.source.findUnique({ where: { id } });
        if (!source || !source.fileUrl) {
            res.status(404).json({ error: 'Source not found or not a file' });
            return;
        }

        // Verify user vault access (Contributor+)
        const member = await prisma.vaultUser.findFirst({
            where: { vaultId: source.vaultId, userId }
        });

        if (!member || (member.role !== 'OWNER' && member.role !== 'CONTRIBUTOR')) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        const key = keyFromFileUrl(source.fileUrl);
        if (!key) {
            res.status(400).json({ error: 'Invalid file URL' });
            return;
        }

        const bucket = process.env.AWS_BUCKET_NAME;
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: content,
            ContentType: 'text/plain'
        });

        await s3Client.send(command);

        // Audit Log
        await prisma.auditLog.create({
            data: {
                vaultId: source.vaultId,
                userId: userId!,
                action: 'SOURCE_UPDATED',
                details: { sourceId: id, fileName: source.title }
            }
        });

        // Invalidate cache
        await deleteCachePattern(`sources:${source.vaultId}`);

        // Emit update
        getIO().to(source.vaultId).emit('source_updated', { ...source, updatedAt: new Date() });

        res.json({ success: true });
    } catch (error) {
        console.error('Update Source Error:', error);
        res.status(500).json({ error: 'Failed to update source content' });
    }
};
