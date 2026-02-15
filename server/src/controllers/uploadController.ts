import { Request, Response } from 'express';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});

export const getUploadUrl = async (req: Request, res: Response) => {
    try {
        const { fileName, fileType } = req.body;

        if (!fileName || !fileType) {
            res.status(400).json({ error: 'File name and type required' });
            return;
        }

        const bucket = process.env.AWS_BUCKET_NAME;
        const hasCreds = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
        if (!bucket || !hasCreds) {
            res.status(503).json({
                error: 'S3 not configured',
                hint: 'Set AWS_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in server/.env'
            });
            return;
        }

        const key = `uploads/${uuidv4()}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: fileType
        });

        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        const region = process.env.AWS_REGION || 'us-east-1';

        res.json({
            uploadUrl: presignedUrl,
            fileUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
            key
        });
    } catch (error) {
        console.error('S3 Presign Error:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
};

/** Derive S3 key from stored fileUrl (e.g. https://bucket.s3.region.amazonaws.com/uploads/xxx.pdf → uploads/xxx.pdf) */
function keyFromFileUrl(fileUrl: string): string | null {
    try {
        const pathname = new URL(fileUrl).pathname;
        const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;
        return decodeURIComponent(key) || null;
    } catch {
        return null;
    }
}

export const getViewUrl = async (req: Request, res: Response) => {
    try {
        const { fileUrl } = req.body;

        if (!fileUrl || typeof fileUrl !== 'string') {
            res.status(400).json({ error: 'fileUrl is required' });
            return;
        }

        const bucket = process.env.AWS_BUCKET_NAME;
        const hasCreds = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
        if (!bucket || !hasCreds) {
            res.status(503).json({
                error: 'S3 not configured',
                hint: 'Set AWS_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in server/.env'
            });
            return;
        }

        const key = keyFromFileUrl(fileUrl);
        if (!key) {
            res.status(400).json({ error: 'Invalid fileUrl; could not derive S3 key' });
            return;
        }

        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        const viewUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        res.json({ viewUrl });
    } catch (error) {
        console.error('S3 getViewUrl Error:', error);
        res.status(500).json({ error: 'Failed to generate view URL' });
    }
};
