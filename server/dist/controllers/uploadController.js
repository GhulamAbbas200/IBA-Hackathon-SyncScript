"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUploadUrl = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const uuid_1 = require("uuid");
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});
const getUploadUrl = async (req, res) => {
    try {
        const { fileName, fileType } = req.body;
        if (!fileName || !fileType) {
            res.status(400).json({ error: 'File name and type required' });
            return;
        }
        const key = `uploads/${(0, uuid_1.v4)()}-${fileName}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            ContentType: fileType
        });
        const presignedUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: 3600 });
        res.json({
            uploadUrl: presignedUrl,
            fileUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
            key
        });
    }
    catch (error) {
        console.error('S3 Presign Error:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
};
exports.getUploadUrl = getUploadUrl;
//# sourceMappingURL=uploadController.js.map