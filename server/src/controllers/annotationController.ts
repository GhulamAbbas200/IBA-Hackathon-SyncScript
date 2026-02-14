import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';
import { getIO } from '../services/socketService';

const prisma = new PrismaClient();

export const createAnnotation = async (req: Request, res: Response) => {
    try {
        const { sourceId, content, position } = req.body;
        const userId = (req as AuthRequest).user?.id;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const annotation = await prisma.annotation.create({
            data: {
                sourceId,
                userId,
                content,
                position
            }
        });

        // Emit real-time event to the source room
        try {
            getIO().to(`source_${sourceId}`).emit('annotation_added', annotation);
        } catch (e) {
            console.error("Socket emit failed", e);
        }

        res.json(annotation);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create annotation' });
    }
};

export const getAnnotations = async (req: Request, res: Response) => {
    try {
        const { sourceId } = req.query;
        if (!sourceId || typeof sourceId !== 'string') {
            res.status(400).json({ error: 'Source ID required' });
            return;
        }

        const annotations = await prisma.annotation.findMany({
            where: { sourceId },
            include: { user: { select: { name: true, id: true } } }
        });
        res.json(annotations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch annotations' });
    }
};
