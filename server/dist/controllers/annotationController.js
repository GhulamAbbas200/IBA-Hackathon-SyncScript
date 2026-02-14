"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnnotations = exports.createAnnotation = void 0;
const client_1 = require("@prisma/client");
const socketService_1 = require("../services/socketService");
const prisma = new client_1.PrismaClient();
const createAnnotation = async (req, res) => {
    try {
        const { sourceId, content, position } = req.body;
        const userId = req.user?.id;
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
            (0, socketService_1.getIO)().to(`source_${sourceId}`).emit('annotation_added', annotation);
        }
        catch (e) {
            console.error("Socket emit failed", e);
        }
        res.json(annotation);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create annotation' });
    }
};
exports.createAnnotation = createAnnotation;
const getAnnotations = async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch annotations' });
    }
};
exports.getAnnotations = getAnnotations;
//# sourceMappingURL=annotationController.js.map